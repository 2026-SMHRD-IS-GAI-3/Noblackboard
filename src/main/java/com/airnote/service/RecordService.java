package com.airnote.service;

import java.io.IOException;
import java.nio.file.Paths;

import javax.servlet.ServletContext;
import javax.servlet.http.Part;

import com.airnote.dao.RecordDAO;
import com.airnote.model.RecordImage;
import com.airnote.util.FileUploadUtil;

public class RecordService {

	private RecordDAO recordDAO = new RecordDAO();

	public RecordImage saveCaptureImage(ServletContext context, int presentationId, int pageNo, Part imagePart)
			throws IOException {

		// 1. 이미지 파일이 비어있는지 확인
		if (imagePart == null || imagePart.getSize() == 0) {
			throw new IOException("저장할 캡처 이미지가 없습니다.");
		}

		// 2. 이미지 파일인지 확인
		String contentType = imagePart.getContentType();

		if (contentType == null || !contentType.startsWith("image/")) {
			throw new IOException("이미지 파일만 업로드할 수 있습니다.");
		}

		// 3. 실제 저장 폴더 경로 만들기
		String uploadDir = context.getRealPath("/uploads/records");

		if (uploadDir == null) {
			throw new IOException("업로드 경로를 찾을 수 없습니다.");
		}

		// 4. 저장될 파일 이름 앞부분 만들기
		String filePrefix = "presentation_" + presentationId + "_page_" + pageNo;

		// 5. 이미지 파일 서버에 저장
		String savedFileName = FileUploadUtil.savePart(imagePart, uploadDir, filePrefix);

		// 6. 프론트에서 접근할 수 있는 이미지 URL 만들기
		String imageUrl = context.getContextPath() + "/uploads/records/" + savedFileName;

		// 7. DB에 저장할 객체 만들기
		RecordImage recordImage = new RecordImage();
		recordImage.setPresentationId(presentationId);
		recordImage.setPageNo(pageNo);
		recordImage.setImageUrl(imageUrl);
		recordImage.setOriginalFileName(getOriginalFileName(imagePart));
		recordImage.setSavedFileName(savedFileName);
		recordImage.setFileSize(imagePart.getSize());

		// 8. DB 저장
		int recordImageId = recordDAO.insertRecordImage(recordImage);

		if (recordImageId == 0) {
			throw new IOException("DB에 캡처 이미지 기록 저장 실패");
		}

		// 9. 생성된 PK값 넣어서 반환
		recordImage.setRecordImageId(recordImageId);

		return recordImage;
	}

	private String getOriginalFileName(Part part) {
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
}