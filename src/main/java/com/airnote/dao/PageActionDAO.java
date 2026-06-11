package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import com.airnote.model.PageAction;
import com.airnote.util.DBUtil;

// TB_PAGE_ACTION 테이블에 페이지 이동 기록을 저장하는 DB 클래스

public class PageActionDAO {

	// 페이지 이동 기록 저장
	public int insertPageAction(PageAction pageAction) {
		int pageActionId = 0;

		String sql = "INSERT INTO TB_PAGE_ACTION "
				+ "(PAGE_ACTION_ID, PRESENTATION_ID, FROM_PAGE_NO, TO_PAGE_NO, ACTION_TYPE, CREATED_AT) "
				+ "VALUES (SEQ_PAGE_ACTION_ID.NEXTVAL, ?, ?, ?, ?, SYSDATE)";

		String selectSql = "SELECT SEQ_PAGE_ACTION_ID.CURRVAL FROM DUAL";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, pageAction.getPresentationId());
			ps.setInt(2, pageAction.getFromPageNo());
			ps.setInt(3, pageAction.getToPageNo());
			ps.setString(4, pageAction.getActionType());

			int result = ps.executeUpdate();

			if (result > 0) {
				try (PreparedStatement ps2 = conn.prepareStatement(selectSql); ResultSet rs = ps2.executeQuery()) {
					if (rs.next()) {
						pageActionId = rs.getInt(1);
					}
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return pageActionId;
	}

	// 특정 발표의 페이지 이동 기록 목록 조회
	public java.util.List<PageAction> selectPageActionList(int presentationId) {
		java.util.List<PageAction> list = new java.util.ArrayList<>();

		String sql = "SELECT PAGE_ACTION_ID, PRESENTATION_ID, FROM_PAGE_NO, TO_PAGE_NO, ACTION_TYPE "
				+ "FROM TB_PAGE_ACTION " + "WHERE PRESENTATION_ID = ? " + "ORDER BY PAGE_ACTION_ID";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
			ps.setInt(1, presentationId);

			try (ResultSet rs = ps.executeQuery()) {
				while (rs.next()) {
					PageAction pageAction = new PageAction();

					pageAction.setPageActionId(rs.getInt("PAGE_ACTION_ID"));
					pageAction.setPresentationId(rs.getInt("PRESENTATION_ID"));
					pageAction.setFromPageNo(rs.getInt("FROM_PAGE_NO"));
					pageAction.setToPageNo(rs.getInt("TO_PAGE_NO"));
					pageAction.setActionType(rs.getString("ACTION_TYPE"));

					list.add(pageAction);
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return list;
	}
}