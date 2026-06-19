param(
    [ValidateSet("check", "backend", "stt", "frontend", "all")]
    [string]$Action = "check"
)

$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $false
}
$Script:Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Script:LogsDir = Join-Path $Script:Root "logs"
$Script:Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Script:LogFile = Join-Path $Script:LogsDir ("{0}_{1}.log" -f $Action, $Script:Stamp)
$Script:AppName = "AirNote_Backend"
$Script:BackendHealthUrl = "http://localhost:8090/AirNote_Backend/api/health"
$Script:FrontendUrl = "http://localhost:5173/"
$Script:FrontendProbeUrl = "http://127.0.0.1:5173/"
$Script:PresentationUrl = "http://localhost:5173/pages/presentation.html"
$Script:DebugUrl = "http://localhost:5173/pages/presentation.html?debug=1"
$Script:SttHealthUrl = "http://127.0.0.1:8000/health"
$Script:LogWriteFailed = $false

New-Item -ItemType Directory -Force -Path $Script:LogsDir | Out-Null

function Add-LogLine {
    param([string]$Line)
    if ($Script:LogWriteFailed) {
        return
    }
    try {
        Add-Content -LiteralPath $Script:LogFile -Value $Line -Encoding UTF8 -ErrorAction Stop
    } catch {
        $Script:LogWriteFailed = $true
        Write-Host ("[WARN] 로그 파일 저장 실패. 콘솔 출력만 유지합니다: {0}" -f $_.Exception.Message)
    }
}

function Write-Log {
    param([string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format "HH:mm:ss"), $Message
    Write-Host $line
    Add-LogLine $line
}

function Write-Plain {
    param([string]$Message)
    Write-Host $Message
    Add-LogLine $Message
}

function Fail {
    param([string]$Message)
    Write-Log "[ERROR] $Message"
    Write-Log "[INFO] Log file: $Script:LogFile"
    exit 1
}

function Warn {
    param([string]$Message)
    Write-Log "[WARN] $Message"
}

function Ok {
    param([string]$Message)
    Write-Log "[OK] $Message"
}

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-CmdExe {
    if ($env:ComSpec -and (Test-Path $env:ComSpec)) { return $env:ComSpec }
    $systemCmd = Join-Path $env:SystemRoot "System32\cmd.exe"
    if (Test-Path $systemCmd) { return $systemCmd }
    return "cmd.exe"
}

function Quote-ProcessArgument {
    param([string]$Argument)
    if ($null -eq $Argument -or $Argument.Length -eq 0) { return '""' }
    if ($Argument -notmatch '[\s"]') { return $Argument }
    $escaped = $Argument -replace '(\\*)"', '$1$1\"'
    $escaped = $escaped -replace '(\\+)$', '$1$1'
    return '"' + $escaped + '"'
}

function Join-ProcessArguments {
    param([string[]]$Arguments = @())
    return (($Arguments | ForEach-Object { Quote-ProcessArgument $_ }) -join " ")
}

function Copy-CleanProcessEnvironment {
    param($TargetEnvironment)
    $pathParts = New-Object System.Collections.Generic.List[string]
    foreach ($key in [Environment]::GetEnvironmentVariables("Process").Keys) {
        $value = [Environment]::GetEnvironmentVariable([string]$key, "Process")
        if ([string]$key -ieq "Path") {
            if (-not [string]::IsNullOrWhiteSpace($value)) { $pathParts.Add($value) }
            continue
        }
        if (-not $TargetEnvironment.ContainsKey([string]$key)) {
            $TargetEnvironment[[string]$key] = $value
        }
    }
    if ($pathParts.Count -gt 0) {
        $TargetEnvironment["Path"] = (($pathParts | Select-Object -Unique) -join [IO.Path]::PathSeparator)
    }
}

function Invoke-Logged {
    param(
        [string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = $Script:Root,
        [hashtable]$ExtraEnv = @{}
    )
    $old = @{}
    foreach ($key in $ExtraEnv.Keys) {
        $old[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
        [Environment]::SetEnvironmentVariable($key, [string]$ExtraEnv[$key], "Process")
    }
    try {
        $safeName = [IO.Path]::GetFileNameWithoutExtension($FilePath) -replace '[^A-Za-z0-9_.-]', '_'
        $stdoutFile = Join-Path $Script:LogsDir ("process_{0}_{1}_out.log" -f $safeName, ([Guid]::NewGuid().ToString("N")))
        $stderrFile = Join-Path $Script:LogsDir ("process_{0}_{1}_err.log" -f $safeName, ([Guid]::NewGuid().ToString("N")))
        $psi = [System.Diagnostics.ProcessStartInfo]::new()
        $psi.FileName = $FilePath
        $psi.Arguments = Join-ProcessArguments $Arguments
        $psi.WorkingDirectory = $WorkingDirectory
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.Environment.Clear()
        Copy-CleanProcessEnvironment $psi.Environment
        $process = [System.Diagnostics.Process]::new()
        $process.StartInfo = $psi
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        Set-Content -LiteralPath $stdoutFile -Value $stdout -Encoding UTF8
        Set-Content -LiteralPath $stderrFile -Value $stderr -Encoding UTF8

        foreach ($file in @($stdoutFile, $stderrFile)) {
            if (-not (Test-Path $file)) { continue }
            Get-Content -LiteralPath $file -ErrorAction SilentlyContinue | ForEach-Object {
                Write-Plain ("      " + $_.ToString())
            }
        }
        return [int]$process.ExitCode
    }
    finally {
        foreach ($key in $ExtraEnv.Keys) {
            [Environment]::SetEnvironmentVariable($key, $old[$key], "Process")
        }
    }
}

function Get-PortOwner {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) { return $null }
    $proc = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $conn.OwningProcess) -ErrorAction SilentlyContinue
    [pscustomobject]@{
        Port = $Port
        Pid = $conn.OwningProcess
        ProcessName = if ($proc) { Split-Path $proc.ExecutablePath -Leaf } else { "" }
        CommandLine = if ($proc) { $proc.CommandLine } else { "" }
    }
}

function Get-FreePort {
    param([int]$StartPort)
    for ($port = $StartPort; $port -lt ($StartPort + 50); $port++) {
        if (-not (Get-PortOwner $port)) { return $port }
    }
    Fail "No free port found starting at $StartPort."
}

function Show-PortOwner {
    param([int]$Port)
    $owner = Get-PortOwner $Port
    if ($owner) {
        Warn ("Port {0} is already used. PID={1}, Process={2}" -f $Port, $owner.Pid, $owner.ProcessName)
        if ($owner.CommandLine) { Write-Log ("[INFO] CommandLine: {0}" -f $owner.CommandLine) }
    }
    return $owner
}

function Test-OwnerFromPath {
    param($Owner, [string]$Path)
    if (-not $Owner -or -not $Owner.CommandLine -or -not $Path) { return $false }
    $resolved = (Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue)
    if (-not $resolved) { return $false }
    $needle = $resolved.Path.ToLowerInvariant()
    return $Owner.CommandLine.ToLowerInvariant().Contains($needle)
}

function Test-AirNotePortOwner {
    param($Owner)
    if (-not $Owner -or -not $Owner.CommandLine) { return $false }
    $cmd = $Owner.CommandLine.ToLowerInvariant()
    return ($cmd.Contains("front_engine_split_gesture_fix") -or
        $cmd.Contains("stt_server") -or
        $cmd.Contains("airnote_backend") -or
        $cmd.Contains("vite") -or
        $cmd.Contains("uvicorn app:app"))
}

function Stop-StaleAirNotePortOwner {
    param($Owner, [int]$Port)
    if (-not (Test-AirNotePortOwner $Owner)) {
        Fail "Port $Port is occupied by another program. Stop that process or change ports manually."
    }
    Warn "Port $Port is used by another AirNote copy. Stopping it so this folder can run cleanly."
    try {
        Stop-Process -Id $Owner.Pid -Force -ErrorAction Stop
        Start-Sleep -Seconds 2
    } catch {
        Fail "Failed to stop stale AirNote process on port $Port. PID=$($Owner.Pid). $($_.Exception.Message)"
    }
    if (Get-PortOwner $Port) {
        Fail "Port $Port is still occupied after stopping stale AirNote process."
    }
}

function Wait-Http {
    param([string]$Url, [int]$Seconds = 40)
    for ($i = 1; $i -le $Seconds; $i++) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
        }
        catch { }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Find-FrontendDir {
    $candidates = @(
        (Join-Path $Script:Root "Front"),
        (Join-Path $Script:Root "Frontend"),
        (Join-Path $Script:Root "front"),
        (Join-Path $Script:Root "Front_engine_split_gesture_fix")
    )
    foreach ($dir in $candidates) {
        if ((Test-Path (Join-Path $dir "package.json")) -and (Test-Path (Join-Path $dir "index.html"))) {
            return (Resolve-Path $dir).Path
        }
    }
    $found = Get-ChildItem -LiteralPath $Script:Root -Directory -Recurse -Depth 3 -ErrorAction SilentlyContinue |
        Where-Object { (Test-Path (Join-Path $_.FullName "package.json")) -and (Test-Path (Join-Path $_.FullName "index.html")) } |
        Select-Object -First 1
    if ($found) { return $found.FullName }
    return $null
}

function Find-SttDir {
    $front = Find-FrontendDir
    $candidates = @(
        (Join-Path $Script:Root "stt_server"),
        $(if ($front) { Join-Path $front "stt_server" })
    ) | Where-Object { $_ }
    foreach ($dir in $candidates) {
        if ((Test-Path (Join-Path $dir "app.py")) -and (Test-Path (Join-Path $dir "requirements.txt"))) {
            return (Resolve-Path $dir).Path
        }
    }
    $found = Get-ChildItem -LiteralPath $Script:Root -Directory -Recurse -Depth 5 -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq "stt_server" -and (Test-Path (Join-Path $_.FullName "app.py")) } |
        Select-Object -First 1
    if ($found) { return $found.FullName }
    return $null
}

function Get-Jdk {
    $candidates = New-Object System.Collections.Generic.List[string]
    if ($env:JAVA_HOME) { $candidates.Add($env:JAVA_HOME) }
    $javac = Get-Command javac -ErrorAction SilentlyContinue
    if ($javac) { $candidates.Add((Split-Path (Split-Path $javac.Source -Parent) -Parent)) }
    $roots = @(
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Java",
        "C:\Program Files\Microsoft",
        "C:\Program Files\BellSoft",
        "C:\Program Files\Amazon Corretto",
        "C:\Program Files\Zulu"
    )
    foreach ($root in $roots) {
        if (Test-Path $root) {
            Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
                ForEach-Object { $candidates.Add($_.FullName) }
        }
    }
    foreach ($dir in ($candidates | Select-Object -Unique)) {
            if ((Test-Path (Join-Path $dir "bin\java.exe")) -and (Test-Path (Join-Path $dir "bin\javac.exe"))) {
            $javaExe = Join-Path $dir "bin\java.exe"
            $line = & (Get-CmdExe) /c "`"$javaExe`" -version 2>&1" | Select-Object -First 1
            $major = 0
            if ($line -match '"(\d+)') { $major = [int]$Matches[1] }
            if ($major -ge 21) {
                [Environment]::SetEnvironmentVariable("JAVA_HOME", $dir, "Process")
                return $dir
            }
        }
    }
    return $null
}

function Get-PythonCommand {
    $commands = @(
        @{ File = "py"; Args = @("-3") },
        @{ File = "python"; Args = @() },
        @{ File = "python3"; Args = @() }
    )
    foreach ($cmd in $commands) {
        if (-not (Test-Command $cmd.File)) { continue }
        try {
            & $cmd.File @($cmd.Args + @("-c", "import sys; raise SystemExit(0 if sys.version_info >= (3,8) else 1)")) 2>$null
            if ($LASTEXITCODE -eq 0) { return $cmd }
        }
        catch { }
    }
    $dirs = @(
        "$env:USERPROFILE\anaconda3",
        "$env:USERPROFILE\Anaconda3",
        "$env:USERPROFILE\miniconda3",
        "$env:USERPROFILE\Miniconda3",
        "C:\ProgramData\anaconda3",
        "C:\ProgramData\Anaconda3",
        "C:\ProgramData\miniconda3",
        "C:\anaconda3",
        "C:\miniconda3"
    )
    foreach ($dir in $dirs) {
        $exe = Join-Path $dir "python.exe"
        if (Test-Path $exe) { return @{ File = $exe; Args = @() } }
    }
    return $null
}

function Invoke-Python {
    param([hashtable]$Python, [string[]]$Arguments, [string]$WorkingDirectory = $Script:Root)
    return Invoke-Logged -FilePath $Python.File -Arguments @($Python.Args + $Arguments) -WorkingDirectory $WorkingDirectory
}

function Load-BackendEnv {
    $envFile = Join-Path $Script:Root "backend.local.env"
    $map = [ordered]@{}
    if (Test-Path $envFile) {
        foreach ($line in Get-Content -LiteralPath $envFile -ErrorAction SilentlyContinue) {
            if ($line -match '^\s*set\s+"([^=]+)=(.*)"\s*$') {
                $map[$Matches[1]] = $Matches[2]
                [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
            }
        }
    }
    return $map
}

function Save-BackendEnv {
    param($Map)
    $envFile = Join-Path $Script:Root "backend.local.env"
    $order = @(
        "JAVA_HOME", "TOMCAT_HOME", "CATALINA_HOME",
        "AIRNOTE_DB_URL", "AIRNOTE_DB_USERNAME", "AIRNOTE_DB_PASSWORD",
        "AIRNOTE_UPLOAD_DIR", "AIRNOTE_CORS_ORIGINS", "AIRNOTE_USER_SEQUENCE"
    )
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($key in $order) {
        if ($Map.Contains($key)) { $lines.Add(('set "{0}={1}"' -f $key, $Map[$key])) }
    }
    foreach ($key in $Map.Keys) {
        if ($order -notcontains $key) { $lines.Add(('set "{0}={1}"' -f $key, $Map[$key])) }
    }
    Set-Content -LiteralPath $envFile -Value $lines -Encoding UTF8
}

function Find-Tomcat {
    $envMap = Load-BackendEnv
    $localTomcat = Join-Path $Script:Root "tomcat"
    if (Test-Path (Join-Path $localTomcat "bin\catalina.bat")) { return (Resolve-Path $localTomcat).Path }
    $localExisting = Get-ChildItem -LiteralPath $Script:Root -Directory -Filter "apache-tomcat*" -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName "bin\catalina.bat") } |
        Select-Object -First 1
    if ($localExisting) { return $localExisting.FullName }
    $zip = Join-Path $Script:Root "tomcat9.zip"
    if (Test-Path $zip) {
        Write-Log "[INSTALL] Extracting bundled tomcat9.zip into the project folder."
        $tmp = Join-Path $Script:Root ("tomcat_extract_" + $Script:Stamp)
        try {
            Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
            $first = Get-ChildItem -LiteralPath $tmp -Directory | Select-Object -First 1
            if ($first) {
                if (Test-Path $localTomcat) { Remove-Item -LiteralPath $localTomcat -Recurse -Force }
                Move-Item -LiteralPath $first.FullName -Destination $localTomcat
            }
        }
        catch {
            Warn "Bundled tomcat9.zip could not be extracted. It may be incomplete or corrupt. Falling back to installed Tomcat detection."
        }
        Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path (Join-Path $localTomcat "bin\catalina.bat")) { return $localTomcat }
    }
    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($key in @("TOMCAT_HOME", "CATALINA_HOME")) {
        if ([Environment]::GetEnvironmentVariable($key, "Process")) {
            $candidates.Add([Environment]::GetEnvironmentVariable($key, "Process"))
        }
        if ([Environment]::GetEnvironmentVariable($key, "User")) {
            $candidates.Add([Environment]::GetEnvironmentVariable($key, "User"))
        }
    }
    $roots = @("C:\Program Files", "C:\Program Files (x86)", "C:\Program Files\Apache Software Foundation", "$env:USERPROFILE\Downloads", "$env:USERPROFILE\Desktop", "C:\tools", "C:\dev")
    foreach ($root in $roots) {
        if (Test-Path $root) {
            Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match "tomcat|apache-tomcat" } |
                ForEach-Object { $candidates.Add($_.FullName) }
        }
    }
    foreach ($dir in ($candidates | Select-Object -Unique)) {
        if (Test-Path (Join-Path $dir "bin\catalina.bat")) {
            $resolved = (Resolve-Path $dir).Path
            if (-not $resolved.StartsWith($Script:Root, [System.StringComparison]::OrdinalIgnoreCase)) {
                try {
                    Warn "Installed Tomcat was found outside the project. Copying it into the project folder so AirNote can use its own stable ports."
                    if (Test-Path $localTomcat) { Remove-Item -LiteralPath $localTomcat -Recurse -Force }
                    Copy-Item -LiteralPath $resolved -Destination $localTomcat -Recurse -Force
                    if (Test-Path (Join-Path $localTomcat "bin\catalina.bat")) { return $localTomcat }
                }
                catch {
                    Warn "Could not copy installed Tomcat into the project folder. Falling back to the installed Tomcat without editing its config."
                }
            }
            return $resolved
        }
    }
    return $null
}

function Ensure-TomcatPorts {
    param([string]$TomcatHome, [int]$ShutdownPort = 8005)
    $serverXml = Join-Path $TomcatHome "conf\server.xml"
    if (-not (Test-Path $serverXml)) { return }
    [xml]$xml = Get-Content -LiteralPath $serverXml
    if ($xml.Server.port -ne [string]$ShutdownPort) { $xml.Server.port = [string]$ShutdownPort }
    foreach ($connector in $xml.Server.Service.Connector) {
        if ($connector.protocol -match "HTTP/1.1" -or $connector.protocol -match "org.apache.coyote.http11") {
            $connector.port = "8090"
            break
        }
    }
    $xml.Save($serverXml)
}

function Ensure-BackendEnv {
    param([string]$JavaHome, [string]$TomcatHome)
    $envFile = Join-Path $Script:Root "backend.local.env"
    $map = Load-BackendEnv
    if (-not (Test-Path $envFile)) {
        Warn "backend.local.env was missing. A new file will be created from detected paths."
        $example = Join-Path $Script:Root "backend.local.env.example"
        if (Test-Path $example) {
            foreach ($line in Get-Content -LiteralPath $example) {
                if ($line -match '^\s*set\s+"([^=]+)=(.*)"\s*$') { $map[$Matches[1]] = $Matches[2] }
            }
        }
    }
    $map["JAVA_HOME"] = $JavaHome
    $map["TOMCAT_HOME"] = $TomcatHome
    $map["CATALINA_HOME"] = $TomcatHome
    if (-not $map.Contains("AIRNOTE_UPLOAD_DIR") -or [string]::IsNullOrWhiteSpace($map["AIRNOTE_UPLOAD_DIR"]) -or $map["AIRNOTE_UPLOAD_DIR"] -eq ".\uploads") {
        $map["AIRNOTE_UPLOAD_DIR"] = Join-Path $Script:Root "uploads"
    }
    if (-not $map.Contains("AIRNOTE_CORS_ORIGINS") -or [string]::IsNullOrWhiteSpace($map["AIRNOTE_CORS_ORIGINS"])) {
        $map["AIRNOTE_CORS_ORIGINS"] = "http://localhost:5173,http://127.0.0.1:5173"
    }
    Save-BackendEnv $map
    Load-BackendEnv | Out-Null
    if (-not (Test-Path $env:AIRNOTE_UPLOAD_DIR)) {
        New-Item -ItemType Directory -Force -Path $env:AIRNOTE_UPLOAD_DIR | Out-Null
    }
    foreach ($key in @("AIRNOTE_DB_URL", "AIRNOTE_DB_USERNAME", "AIRNOTE_DB_PASSWORD", "AIRNOTE_UPLOAD_DIR")) {
        $value = [Environment]::GetEnvironmentVariable($key, "Process")
        if ([string]::IsNullOrWhiteSpace($value) -or $value -match "change-me|@host:|airnote$") {
            Fail "$key is missing or still has an example value. Edit backend.local.env and run again."
        }
    }
    Ok "backend.local.env is ready."
}

function Find-OjdbcJar {
    $m2 = Join-Path $env:USERPROFILE ".m2\repository\com\oracle\database\jdbc"
    if (Test-Path $m2) {
        $jar = Get-ChildItem -LiteralPath $m2 -Recurse -File -Filter "ojdbc*.jar" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($jar) { return $jar.FullName }
    }
    $target = Join-Path $Script:Root "target"
    if (Test-Path $target) {
        $jar = Get-ChildItem -LiteralPath $target -Recurse -File -Filter "ojdbc*.jar" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($jar) { return $jar.FullName }
    }
    return $null
}

function Resolve-MavenDeps {
    $mvnw = Join-Path $Script:Root "mvnw.cmd"
    if (-not (Test-Path $mvnw)) { return }
    if (Find-OjdbcJar) { return }
    Write-Log "[INSTALL] Oracle JDBC driver is not in the local Maven cache. Running Maven dependency resolve."
    $code = Invoke-Logged -FilePath $mvnw -Arguments @("-q", "-DskipTests", "dependency:resolve") -WorkingDirectory $Script:Root
    if ($code -ne 0) { Warn "Maven dependency resolve failed. DB driver may still be missing." }
}

function Test-OracleDb {
    $url = $env:AIRNOTE_DB_URL
    $user = $env:AIRNOTE_DB_USERNAME
    $pass = $env:AIRNOTE_DB_PASSWORD
    if ($url -match "@(localhost|127\.0\.0\.1)") {
        $svc = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "OracleService|Oracle.*TNS|Oracle.*Listener" }
        if (-not $svc) { Warn "Local Oracle service was not found. If DB is local, start Oracle first." }
        elseif ($svc | Where-Object Status -eq "Running") { Ok "Local Oracle service is running." }
        else { Warn "Oracle service exists but is not running." }
    }
    else {
        Ok "Oracle DB URL points to a remote host; local Oracle service is not required."
    }
    $jar = Find-OjdbcJar
    if (-not $jar) { Fail "Oracle JDBC driver was not found. Run Maven dependency download or check internet access." }
    $tmp = Join-Path $Script:LogsDir ("dbcheck_" + $Script:Stamp)
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $javaFile = Join-Path $tmp "AirNoteDbCheck.java"
    @'
import java.sql.*;
public class AirNoteDbCheck {
  public static void main(String[] args) throws Exception {
    Class.forName("oracle.jdbc.OracleDriver");
    try (Connection c = DriverManager.getConnection(args[0], args[1], args[2])) {
      try (PreparedStatement ps = c.prepareStatement("SELECT USER FROM DUAL"); ResultSet rs = ps.executeQuery()) {
        if (rs.next()) System.out.println("CONNECTED_USER=" + rs.getString(1));
      }
      String[] sequences = {"SEQ_USER_ID","SEQ_PDF_ID","SEQ_PRESENTATION_ID","SEQ_ANNOTATION_ID","SEQ_PAGE_ACTION_ID","SEQ_RECORD_IMAGE"};
      for (String seq : sequences) {
        try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM USER_SEQUENCES WHERE SEQUENCE_NAME=?")) {
          ps.setString(1, seq);
          try (ResultSet rs = ps.executeQuery()) {
            rs.next();
            if (rs.getInt(1) == 0) {
              System.out.println("SEQUENCE_MISSING=" + seq);
              System.exit(3);
            }
          }
        }
      }
      try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME='TB_USER'"); ResultSet rs = ps.executeQuery()) {
        rs.next();
        if (rs.getInt(1) == 0) {
          System.out.println("TABLE_MISSING=TB_USER");
          System.exit(4);
        }
      }
      System.out.println("DB_CHECK_OK");
    }
  }
}
'@ | Set-Content -LiteralPath $javaFile -Encoding ASCII
    $javac = Join-Path $env:JAVA_HOME "bin\javac.exe"
    $java = Join-Path $env:JAVA_HOME "bin\java.exe"
    $code = Invoke-Logged -FilePath $javac -Arguments @("-cp", $jar, $javaFile) -WorkingDirectory $tmp
    if ($code -ne 0) { Fail "DB check Java compile failed. Check JDK and ojdbc jar." }
    $outputFile = Join-Path $tmp "dbcheck.out"
    Push-Location $tmp
    & $java -cp ".;$jar" AirNoteDbCheck $url $user $pass > $outputFile 2>&1
    $code = $LASTEXITCODE
    Pop-Location
    Get-Content -LiteralPath $outputFile -ErrorAction SilentlyContinue | ForEach-Object { Write-Plain ("      " + $_) }
    $out = (Get-Content -LiteralPath $outputFile -Raw -ErrorAction SilentlyContinue)
    if ($code -eq 0) { Ok "Oracle DB connection, required table, and sequences are ready."; return }
    if ($out -match "ORA-01017") { Fail "Oracle account or password is wrong. Check AIRNOTE_DB_USERNAME / AIRNOTE_DB_PASSWORD." }
    if ($out -match "TABLE_MISSING|ORA-00942") { Fail "Required DB table is missing. Check DB initialization SQL, but do not run destructive SQL automatically." }
    if ($out -match "SEQUENCE_MISSING|ORA-02289") { Fail "Required DB sequence is missing. Check DB initialization SQL." }
    if ($out -match "Unknown host|Network Adapter|IO Error|Connection refused|Listener|ORA-125") { Fail "Oracle URL/network/listener check failed. Check AIRNOTE_DB_URL and DB service." }
    Fail "Oracle DB check failed. See dbcheck log under $tmp."
}

function Build-Backend {
    $mvnw = Join-Path $Script:Root "mvnw.cmd"
    if (-not (Test-Path $mvnw)) { Fail "mvnw.cmd was not found." }
    Write-Log "[3/5] Building backend WAR."
    $code = Invoke-Logged -FilePath $mvnw -Arguments @("-q", "-DskipTests", "package") -WorkingDirectory $Script:Root
    if ($code -ne 0) { Fail "Backend Maven build failed. Check the log above for compiler/dependency errors." }
    $war = Join-Path $Script:Root "target\AirNote_Backend.war"
    if (-not (Test-Path $war)) { Fail "WAR build did not produce target\AirNote_Backend.war." }
    return $war
}

function Stop-ProjectTomcatIfNeeded {
    param([string]$TomcatHome, [int[]]$Ports = @(8090, 8005))
    foreach ($port in $Ports) {
        $owner = Get-PortOwner $port
        if (-not $owner) { continue }
        if ($owner.CommandLine -and ($owner.CommandLine -like ("*" + $TomcatHome + "*"))) {
            Warn ("Port {0} is used by the configured Tomcat. Restarting it." -f $port)
            Stop-Process -Id $owner.Pid -Force
            Start-Sleep -Seconds 2
        }
        else {
            Show-PortOwner $port | Out-Null
            Fail ("Port {0} is used by another process. This script will not kill it automatically." -f $port)
        }
    }
}

function Start-Backend {
    Write-Log "[1/5] Checking Java, Tomcat, backend env, and Oracle DB."
    $jdk = Get-Jdk
    if (-not $jdk) { Fail "JDK 21+ was not found. Install Eclipse Temurin/Adoptium JDK 21 and run again." }
    Ok "JDK 21+ detected: $jdk"
    $tomcat = Find-Tomcat
    if (-not $tomcat) { Fail "Tomcat 9 was not found. Put tomcat9.zip in the project root or set TOMCAT_HOME." }
    $shutdownPort = 8005
    if ($tomcat.StartsWith($Script:Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $owner8005 = Get-PortOwner 8005
        if ($owner8005 -and (-not $owner8005.CommandLine -or $owner8005.CommandLine -notlike ("*" + $tomcat + "*"))) {
            Show-PortOwner 8005 | Out-Null
            $shutdownPort = Get-FreePort 18005
            Warn "Port 8005 is used by another process. Project Tomcat shutdown port will use $shutdownPort instead."
        }
        Ensure-TomcatPorts $tomcat $shutdownPort
    }
    else {
        Warn "Detected Tomcat is outside the project folder. This script will not edit its server.xml; make sure HTTP=8090 and shutdown=8005."
    }
    Ok "Tomcat detected: $tomcat"
    Ensure-BackendEnv -JavaHome $jdk -TomcatHome $tomcat
    Resolve-MavenDeps
    Test-OracleDb

    Write-Log "[2/5] Checking backend ports 8090 and 8005."
    Stop-ProjectTomcatIfNeeded -TomcatHome $tomcat -Ports @(8090, $shutdownPort)

    $war = Build-Backend

    Write-Log "[4/5] Deploying WAR to Tomcat."
    $webapps = Join-Path $tomcat "webapps"
    $oldWar = Join-Path $webapps "$Script:AppName.war"
    $oldDir = Join-Path $webapps $Script:AppName
    Remove-Item -LiteralPath $oldWar -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $oldDir -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -LiteralPath $war -Destination $oldWar -Force
    if (-not (Test-Path $oldWar)) { Fail "WAR deployment failed: $oldWar was not created." }
    Ok "WAR deployed: $oldWar"

    Write-Log "[5/5] Starting Tomcat and running backend health check."
    $env:JAVA_HOME = $jdk
    $env:TOMCAT_HOME = $tomcat
    $env:CATALINA_HOME = $tomcat
    $env:CATALINA_BASE = $tomcat
    $tomcatOut = Join-Path $Script:LogsDir ("backend_tomcat_start_{0}.log" -f $Script:Stamp)
    $tomcatErr = Join-Path $Script:LogsDir ("backend_tomcat_start_{0}.err.log" -f $Script:Stamp)
    $catalina = Join-Path $tomcat "bin\catalina.bat"
    $startArgs = "/c `"$catalina`" start"
    Start-Process -FilePath (Get-CmdExe) -ArgumentList $startArgs -WorkingDirectory $tomcat -WindowStyle Hidden -RedirectStandardOutput $tomcatOut -RedirectStandardError $tomcatErr | Out-Null
    Write-Log "[INFO] Tomcat start log: $tomcatOut"
    if (Wait-Http $Script:BackendHealthUrl 60) {
        Ok "Backend health check succeeded."
        Write-Log $Script:BackendHealthUrl
        return
    }
    Warn "Backend health check failed."
    $health = $null
    try { $health = Invoke-WebRequest -UseBasicParsing -Uri $Script:BackendHealthUrl -TimeoutSec 4 } catch { $health = $_.Exception.Message }
    Write-Log "[INFO] Health response/error: $health"
    if (-not (Get-PortOwner 8090)) { Warn "Port 8090 is not listening. Tomcat probably failed to start." }
    if (-not (Test-Path $oldWar)) { Warn "WAR file is missing from Tomcat webapps." }
    Warn ("Tomcat log directory: {0}" -f (Join-Path $tomcat "logs"))
    Fail "Backend did not become healthy. Check DB connection, WAR deployment, and Tomcat logs."
}

function Ensure-NodeAndNpm {
    if (-not (Test-Command "node")) { Fail "Node.js was not found. Install Node.js LTS from https://nodejs.org/." }
    if (-not (Test-Command "npm")) { Fail "npm was not found. Reinstall Node.js LTS with npm enabled." }
    $nodeVersion = (& node --version 2>$null)
    $npmVersion = (& npm --version 2>$null)
    Ok "Node.js detected: $nodeVersion"
    Ok "npm detected: $npmVersion"
}

function Ensure-FrontendDeps {
    param([string]$FrontDir)
    if (Test-Path (Join-Path $FrontDir "node_modules")) {
        Ok "Frontend node_modules exists."
        return
    }
    Write-Log "[INSTALL] Frontend dependencies are missing."
    if (Test-Path (Join-Path $FrontDir "package-lock.json")) {
        Write-Log "[INSTALL] Running npm ci first."
        $code = Invoke-Logged -FilePath "npm.cmd" -Arguments @("ci") -WorkingDirectory $FrontDir
        if ($code -eq 0) { Ok "npm ci succeeded."; return }
        Warn "npm ci failed. Falling back to npm install."
    }
    $code = Invoke-Logged -FilePath "npm.cmd" -Arguments @("install") -WorkingDirectory $FrontDir
    if ($code -ne 0) { Fail "npm install failed. Check package download/network errors in the log." }
    Ok "npm install succeeded."
}

function Start-Frontend {
    Write-Log "[1/4] Checking frontend location, Node.js, and npm."
    $front = Find-FrontendDir
    if (-not $front) { Fail "Frontend folder was not found. Expected Front, Frontend, or a folder with package.json and index.html." }
    Ok "Frontend detected: $front"
    Ensure-NodeAndNpm
    Write-Log "[2/4] Checking frontend dependencies."
    Ensure-FrontendDeps $front
    Write-Log "[3/4] Checking frontend port 5173."
    $owner = Get-PortOwner 5173
    if ($owner) {
        Show-PortOwner 5173 | Out-Null
        if ((Test-OwnerFromPath $owner $front) -and (Wait-Http $Script:FrontendProbeUrl 3)) {
            Ok "Port 5173 already serves a web app. Reusing the existing frontend/Vite server."
            Show-FrontendUrls
            return
        }
        Stop-StaleAirNotePortOwner $owner 5173
        $owner = Get-PortOwner 5173
        if (-not $owner) {
            Ok "Port 5173 is now free."
        }
    }
    $owner = Get-PortOwner 5173
    if ($owner) {
        Fail "Port 5173 is occupied but does not respond as a web server. Stop that process or change ports manually."
    }
    Write-Log "[4/4] Starting Vite frontend."
    $out = Join-Path $Script:LogsDir ("frontend_process_{0}.log" -f $Script:Stamp)
    $err = Join-Path $Script:LogsDir ("frontend_process_{0}.err.log" -f $Script:Stamp)
    $args = "/c npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort"
    Start-Process -FilePath (Get-CmdExe) -ArgumentList $args -WorkingDirectory $front -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null
    if (Wait-Http $Script:FrontendProbeUrl 35) {
        Ok "Frontend started."
        Write-Log "[INFO] Frontend process log: $out"
        Show-FrontendUrls
        return
    }
    Fail "Frontend did not start on port 5173. Check $out and $err."
}

function Show-FrontendUrls {
    Write-Log "General     : $Script:FrontendUrl"
    Write-Log "Presentation: $Script:PresentationUrl"
    Write-Log "Debug       : $Script:DebugUrl"
}

function Test-VenvReusable {
    param([string]$SttDir)
    $venvPy = Join-Path $SttDir ".venv\Scripts\python.exe"
    $cfg = Join-Path $SttDir ".venv\pyvenv.cfg"
    if (-not (Test-Path $venvPy) -or -not (Test-Path $cfg)) { return $false }
    $cfgText = Get-Content -LiteralPath $cfg -Raw -ErrorAction SilentlyContinue
    foreach ($line in ($cfgText -split "`r?`n")) {
        if ($line -match "^(home|executable)\s*=\s*(.+)$") {
            $path = $Matches[2].Trim()
            if ($path -and -not (Test-Path $path)) { return $false }
        }
    }
    & $venvPy -c "import fastapi, uvicorn, faster_whisper" 2>$null
    return ($LASTEXITCODE -eq 0)
}

function Ensure-SttVenv {
    param([string]$SttDir)
    $venvDir = Join-Path $SttDir ".venv"
    $venvPy = Join-Path $venvDir "Scripts\python.exe"
    if (Test-VenvReusable $SttDir) {
        Ok "STT virtual environment is reusable on this PC."
        return $venvPy
    }
    if (Test-Path $venvDir) {
        Warn "Existing .venv looks copied or incomplete. Recreating it for this PC."
        Remove-Item -LiteralPath $venvDir -Recurse -Force
    }
    $py = Get-PythonCommand
    if (-not $py) { Fail "Python 3.8+ was not found. Install Python 3.10+ or Anaconda/Miniconda." }
    Write-Log "[INSTALL] Creating STT virtual environment."
    $code = Invoke-Python -Python $py -Arguments @("-m", "venv", $venvDir) -WorkingDirectory $SttDir
    if ($code -ne 0 -or -not (Test-Path $venvPy)) { Fail "Python venv creation failed. Check Python installation and venv module." }
    $code = Invoke-Logged -FilePath $venvPy -Arguments @("-m", "pip", "install", "--upgrade", "pip") -WorkingDirectory $SttDir
    if ($code -ne 0) { Fail "pip upgrade failed in STT venv." }
    if (Test-Path (Join-Path $SttDir "requirements.txt")) {
        $code = Invoke-Logged -FilePath $venvPy -Arguments @("-m", "pip", "install", "-r", (Join-Path $SttDir "requirements.txt")) -WorkingDirectory $SttDir
        if ($code -ne 0) { Fail "STT requirements install failed. Check the package name shown just above this error." }
    }
    Ok "STT virtual environment is ready."
    return $venvPy
}

function Ensure-SttModel {
    param([string]$SttDir, [string]$VenvPython)
    $modelRoot = Join-Path $SttDir "models"
    New-Item -ItemType Directory -Force -Path $modelRoot | Out-Null
    $model = Get-ChildItem -LiteralPath $modelRoot -Recurse -File -Filter "model.bin" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($model) {
        Ok "STT model exists: $($model.FullName)"
        return
    }
    $prepare = Join-Path $SttDir "prepare_model.py"
    if (-not (Test-Path $prepare)) { Fail "STT model is missing and prepare_model.py was not found." }
    Write-Log "[DOWNLOAD] STT model is missing. Downloading once into $modelRoot."
    $code = Invoke-Logged -FilePath $VenvPython -Arguments @($prepare) -WorkingDirectory $SttDir -ExtraEnv @{ AIRNOTE_STT_MODEL_ROOT = $modelRoot; AIRNOTE_STT_LOCAL_ONLY = "0" }
    if ($code -ne 0) { Fail "STT model download failed. Check internet connection or Hugging Face cache access." }
    $model = Get-ChildItem -LiteralPath $modelRoot -Recurse -File -Filter "model.bin" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $model) { Fail "STT model download completed but model.bin was not found." }
    Ok "STT model is ready: $($model.FullName)"
}

function Start-Stt {
    Write-Log "[1/4] Checking STT server folder and Python."
    $stt = Find-SttDir
    if (-not $stt) { Fail "stt_server folder was not found." }
    Ok "STT server detected: $stt"
    Write-Log "[2/4] Checking/recreating STT virtual environment."
    $venvPy = Ensure-SttVenv $stt
    Write-Log "[3/4] Checking STT model files."
    Ensure-SttModel -SttDir $stt -VenvPython $venvPy
    Write-Log "[4/4] Checking STT port 8000 and starting server."
    $owner = Get-PortOwner 8000
    if ($owner) {
        Show-PortOwner 8000 | Out-Null
        if ((Test-OwnerFromPath $owner $stt) -and (Wait-Http $Script:SttHealthUrl 3)) {
            Ok "Port 8000 already has a healthy STT server. Reusing it."
            Write-Log $Script:SttHealthUrl
            return
        }
        Stop-StaleAirNotePortOwner $owner 8000
        $owner = Get-PortOwner 8000
        if (-not $owner) {
            Ok "Port 8000 is now free."
        }
    }
    $owner = Get-PortOwner 8000
    if ($owner) {
        Fail "Port 8000 is occupied but /health does not respond. Stop that process or inspect the PID above."
    }
    $out = Join-Path $Script:LogsDir ("stt_process_{0}.log" -f $Script:Stamp)
    $err = Join-Path $Script:LogsDir ("stt_process_{0}.err.log" -f $Script:Stamp)
    $oldModelRoot = $env:AIRNOTE_STT_MODEL_ROOT
    $oldLocalOnly = $env:AIRNOTE_STT_LOCAL_ONLY
    $env:AIRNOTE_STT_MODEL_ROOT = Join-Path $stt "models"
    $env:AIRNOTE_STT_LOCAL_ONLY = "1"
    Start-Process -FilePath $venvPy -ArgumentList @("-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8000") -WorkingDirectory $stt -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null
    $env:AIRNOTE_STT_MODEL_ROOT = $oldModelRoot
    $env:AIRNOTE_STT_LOCAL_ONLY = $oldLocalOnly
    if (Wait-Http $Script:SttHealthUrl 45) {
        Ok "STT server started."
        Write-Log $Script:SttHealthUrl
        Write-Log "[INFO] STT process log: $out"
        return
    }
    Fail "STT server did not become healthy. Check $out and $err."
}

function Check-Environment {
    Write-Log "[1/5] Checking project paths."
    if (-not (Test-Path (Join-Path $Script:Root "pom.xml"))) { Fail "Backend pom.xml was not found under $Script:Root." }
    $front = Find-FrontendDir
    $stt = Find-SttDir
    if ($front) { Ok "Frontend folder: $front" } else { Warn "Frontend folder was not detected." }
    if ($stt) { Ok "STT folder: $stt" } else { Warn "STT folder was not detected." }

    Write-Log "[2/5] Checking Node.js/npm and Python."
    Ensure-NodeAndNpm
    $py = Get-PythonCommand
    if ($py) { Ok ("Python detected: {0} {1}" -f $py.File, ($py.Args -join " ")) } else { Warn "Python 3.8+ was not detected." }

    Write-Log "[3/5] Checking Java and Tomcat."
    $jdk = Get-Jdk
    if ($jdk) { Ok "JDK 21+ detected: $jdk" } else { Warn "JDK 21+ was not detected." }
    $tomcat = Find-Tomcat
    if ($tomcat) { Ok "Tomcat detected: $tomcat" } else { Warn "Tomcat was not detected." }

    Write-Log "[4/5] Checking ports."
    foreach ($p in @(5173, 8090, 8005, 8000)) {
        $owner = Get-PortOwner $p
        if ($owner) { Show-PortOwner $p | Out-Null } else { Ok "Port $p is free." }
    }

    Write-Log "[5/5] Checking backend env, Oracle DB, and STT model."
    if ($jdk -and $tomcat) {
        Ensure-BackendEnv -JavaHome $jdk -TomcatHome $tomcat
        Resolve-MavenDeps
        Test-OracleDb
    }
    else {
        Warn "Skipping DB connection check because Java or Tomcat is missing."
    }
    if ($stt) {
        $model = Get-ChildItem -LiteralPath (Join-Path $stt "models") -Recurse -File -Filter "model.bin" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($model) { Ok "STT model file exists: $($model.FullName)" } else { Warn "STT model file was not found. run_stt_server.bat will download it once." }
    }
    Ok "Environment check finished."
    Write-Log "[INFO] Log file: $Script:LogFile"
}

function Start-All {
    Write-Log "[1/5] Running environment check."
    Check-Environment
    Write-Log "[2/5] Starting backend."
    Start-Backend
    Write-Log "[3/5] Starting STT server."
    Start-Stt
    Write-Log "[4/5] Starting frontend."
    Start-Frontend
    Write-Log "[5/5] AirNote is ready."
    Write-Log "Backend     : $Script:BackendHealthUrl"
    Write-Log "STT         : $Script:SttHealthUrl"
    Show-FrontendUrls
    Write-Log "[INFO] Log file: $Script:LogFile"
}

Write-Log "================================================"
Write-Log "AirNote runtime action: $Action"
Write-Log "Project root: $Script:Root"
Write-Log "Log file: $Script:LogFile"
Write-Log "================================================"

switch ($Action) {
    "check" { Check-Environment }
    "backend" { Start-Backend; Write-Log "[INFO] Log file: $Script:LogFile" }
    "stt" { Start-Stt; Write-Log "[INFO] Log file: $Script:LogFile" }
    "frontend" { Start-Frontend; Write-Log "[INFO] Log file: $Script:LogFile" }
    "all" { Start-All }
}
