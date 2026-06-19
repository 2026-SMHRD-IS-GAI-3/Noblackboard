package com.airnote.util;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public final class UploadStorage {

	private UploadStorage() {
	}

	public static Path directory(String category) throws IOException {
		String configured = System.getenv("AIRNOTE_UPLOAD_DIR");
		Path root = configured == null || configured.trim().isEmpty()
				? Paths.get(System.getProperty("user.home"), ".airnote", "uploads")
				: Paths.get(configured.trim());
		Path normalizedRoot = root.toAbsolutePath().normalize();
		Path directory = normalizedRoot.resolve(category).normalize();

		if (!directory.startsWith(normalizedRoot)) {
			throw new IOException("Invalid upload category.");
		}

		Files.createDirectories(directory);
		return directory;
	}

	public static Path recordImage(String fileName) throws IOException {
		if (fileName == null || fileName.isEmpty() || !Paths.get(fileName).getFileName().toString().equals(fileName)) {
			throw new IOException("Invalid record image name.");
		}
		return directory("records").resolve(fileName).normalize();
	}
}
