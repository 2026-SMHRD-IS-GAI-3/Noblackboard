package com.airnote.util;

// DB 연결이 정상인지 테스트하기 위한 확인용 클래스

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

public class DBConnectionTest {

	public static void main(String[] args) {

		try (Connection conn = DBUtil.getConnection()) {

			System.out.println("DB 연결 성공!");

			String sql = "SELECT USER FROM DUAL";

			try (PreparedStatement ps = conn.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
				if (rs.next()) {
					System.out.println("현재 접속 계정: " + rs.getString(1));
				}
			}

			String tableSql = "SELECT COUNT(*) FROM TB_USER";

			try (PreparedStatement ps = conn.prepareStatement(tableSql); ResultSet rs = ps.executeQuery()) {
				if (rs.next()) {
					System.out.println("TB_USER 데이터 개수: " + rs.getInt(1));
				}
			}

		} catch (Exception e) {
			System.out.println("DB 연결 실패!");
			e.printStackTrace();
		}
	}
}