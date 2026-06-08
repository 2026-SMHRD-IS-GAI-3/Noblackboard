package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import com.airnote.model.RecordImage;
import com.airnote.util.DBUtil;

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
			e.printStackTrace();
			return 0;
		}

		return recordImageId;
	}
}