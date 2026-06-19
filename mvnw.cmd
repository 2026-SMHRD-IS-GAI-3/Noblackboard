@echo off
setlocal
set "ROOT=%~dp0"
set "MAVEN_HOME=%ROOT%.mvn\apache-maven-3.9.9"
set "ARCHIVE=%ROOT%.mvn\apache-maven-3.9.9-bin.zip"
if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
  echo [INFO] Downloading Maven 3.9.9 for this workspace...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip' -OutFile '%ARCHIVE%';Expand-Archive -LiteralPath '%ARCHIVE%' -DestinationPath '%ROOT%.mvn' -Force"
  if errorlevel 1 exit /b 1
)
call "%MAVEN_HOME%\bin\mvn.cmd" %*
exit /b %errorlevel%
