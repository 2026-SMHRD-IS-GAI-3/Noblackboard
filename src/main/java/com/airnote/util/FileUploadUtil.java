package com.airnote.util;

// 업로드된 PDF나 이미지 파일을 서버 폴더에 저장하는 공통 파일 저장 유틸 클래스

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import javax.servlet.http.Part;

public class FileUploadUtil {

	public static String savePart(Part part, String uploadDir, String filePrefix) throws IOException {
		if (part == null || part.getSize() == 0) {
			throw new IOException("업로드된 파일이 없습니다.");
		}

		// 저장 폴더가 없으면 자동 생성
		Files.createDirectories(Paths.get(uploadDir));

		// 원본 파일명 가져오기
		String originalFileName = getSubmittedFileName(part);

		// 확장자 가져오기
		String extension = getExtension(originalFileName);

		// 확장자가 없으면 기본 png 처리
		if (extension.isEmpty()) {
			extension = ".png";
		}

		// 저장 파일명 생성
		String savedFileName = filePrefix + "_" + System.currentTimeMillis() + extension;

		// 최종 저장 경로
		Path savePath = Paths.get(uploadDir, savedFileName);

		// 파일 저장
		try (InputStream inputStream = part.getInputStream()) {
			Files.copy(inputStream, savePath);
		}

		// 저장된 파일명 반환
		return savedFileName;
	}

	private static String getSubmittedFileName(Part part) {
		String contentDisposition = part.getHeader("content-disposition");

		if (contentDisposition == null) {
			return "";
		}

		String[] items = contentDisposition.split(";");

		for (String item : items) {
			item = item.trim();

			if (item.startsWith("filename")) {
				String fileName = item.substring(item.indexOf("=") + 1).trim().replace("\"", "");

				if (fileName == null || fileName.isEmpty()) {
					return "";
				}

				return Paths.get(fileName).getFileName().toString();
			}
		}

		return "";
	}

	private static String getExtension(String fileName) {
		if (fileName == null || fileName.isEmpty()) {
			return "";
		}

		int dotIndex = fileName.lastIndexOf(".");

		if (dotIndex == -1) {
			return "";
		}

		return fileName.substring(dotIndex);
	}
}