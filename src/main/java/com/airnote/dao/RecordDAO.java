package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

import com.airnote.model.RecordImage;
import com.airnote.util.DBUtil;

// TB_RECORD_IMAGE 테이블에 저장 이미지 정보를 등록하고 조회하는 DB 클래스
//  TB_RECORD_IMAGE에서 presentationId가 같은 이미지들을 전부 가져오는 코드

public class RecordDAO {

	public int insertRecordImage(RecordImage recordImage) {
		int recordImageId = 0;

		String seqSql = "SELECT SEQ_RECORD_IMAGE.NEXTVAL FROM DUAL";

		String insertSql = "INSERT INTO TB_RECORD_IMAGE (" + "RECORD_IMAGE_ID, " + "PRESENTATION_ID, " + "PAGE_NO, "
				+ "IMAGE_URL, " + "ORIGINAL_FILE_NAME, " + "SAVED_FILE_NAME, " + "FILE_SIZE, " + "CREATED_AT"
				+ ") VALUES (?, ?, ?, ?, ?, ?, ?, SYSDATE)";

		try (Connection conn = DBUtil.getConnection();
				PreparedStatement seqPs = conn.prepareStatement(seqSql);
				ResultSet rs = seqPs.executeQuery()) {

			if (rs.next()) {
				recordImageId = rs.getInt(1);
			}

			try (PreparedStatement insertPs = conn.prepareStatement(insertSql)) {
				insertPs.setInt(1, recordImageId);
				insertPs.setInt(2, recordImage.getPresentationId());
				insertPs.setInt(3, recordImage.getPageNo());
				insertPs.setString(4, recordImage.getImageUrl());
				insertPs.setString(5, recordImage.getOriginalFileName());
				insertPs.setString(6, recordImage.getSavedFileName());
				insertPs.setLong(7, recordImage.getFileSize());

				insertPs.executeUpdate();
			}

		} catch (Exception e) {
			throw new IllegalStateException("저장 이미지 DB 등록에 실패했습니다.", e);
		}

		return recordImageId;
	}

	public List<RecordImage> selectImagesByPresentationId(int presentationId) {
		List<RecordImage> imageList = new ArrayList<>();

		String sql = "SELECT " + "RECORD_IMAGE_ID, " + "PRESENTATION_ID, " + "PAGE_NO, " + "IMAGE_URL, "
				+ "ORIGINAL_FILE_NAME, " + "SAVED_FILE_NAME, " + "FILE_SIZE, "
				+ "TO_CHAR(CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT " + "FROM TB_RECORD_IMAGE "
				+ "WHERE PRESENTATION_ID = ? " + "ORDER BY CREATED_AT DESC";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, presentationId);

			try (ResultSet rs = ps.executeQuery()) {
				while (rs.next()) {
					RecordImage image = new RecordImage();

					image.setRecordImageId(rs.getInt("RECORD_IMAGE_ID"));
					image.setPresentationId(rs.getInt("PRESENTATION_ID"));
					image.setPageNo(rs.getInt("PAGE_NO"));
					image.setImageUrl(rs.getString("IMAGE_URL"));
					image.setOriginalFileName(rs.getString("ORIGINAL_FILE_NAME"));
					image.setSavedFileName(rs.getString("SAVED_FILE_NAME"));
					image.setFileSize(rs.getLong("FILE_SIZE"));
					image.setCreatedAt(rs.getString("CREATED_AT"));

					imageList.add(image);
				}
			}

		} catch (Exception e) {
			throw new IllegalStateException("저장 이미지 DB 조회에 실패했습니다.", e);
		}

		return imageList;
	}
}
