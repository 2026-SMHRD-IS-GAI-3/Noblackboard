package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import com.airnote.model.User;
import com.airnote.util.DBUtil;

public class UserDAO {

	// 회원가입
	public int insertUser(User user) {

		int userId = getNextUserId();

		if (userId == 0) {
			return 0;
		}

		String sql = "" + "INSERT INTO TB_USER (" + "    USER_ID, " + "    NAME, " + "    EMAIL, " + "    PASSWORD, "
				+ "    JOIN_DATE " + ") VALUES (" + "    ?, " + "    ?, " + "    ?, " + "    ?, " + "    SYSDATE "
				+ ")";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setInt(1, userId);
			ps.setString(2, user.getName());
			ps.setString(3, user.getEmail());
			ps.setString(4, user.getPassword());

			int result = ps.executeUpdate();

			if (result > 0) {
				return userId;
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return 0;
	}

	// 이메일 중복 확인
	public boolean existsByEmail(String email) {

		String sql = "" + "SELECT COUNT(*) " + "FROM TB_USER " + "WHERE EMAIL = ?";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, email);

			try (ResultSet rs = ps.executeQuery()) {
				if (rs.next()) {
					return rs.getInt(1) > 0;
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return false;
	}

	// 로그인
	public User selectUserByEmailAndPassword(String email, String password) {

		String sql = "" + "SELECT " + "    USER_ID, " + "    NAME, " + "    EMAIL, " + "    PASSWORD, "
				+ "    TO_CHAR(JOIN_DATE, 'YYYY-MM-DD HH24:MI:SS') AS JOIN_DATE " + "FROM TB_USER " + "WHERE EMAIL = ? "
				+ "AND PASSWORD = ?";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {

			ps.setString(1, email);
			ps.setString(2, password);

			try (ResultSet rs = ps.executeQuery()) {
				if (rs.next()) {
					User user = new User();

					user.setUserId(rs.getInt("USER_ID"));
					user.setName(rs.getString("NAME"));
					user.setEmail(rs.getString("EMAIL"));
					user.setPassword(rs.getString("PASSWORD"));
					user.setJoinDate(rs.getString("JOIN_DATE"));

					return user;
				}
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return null;
	}

	// USER_ID 생성
	// 현재 프로젝트에 USER 시퀀스 이름이 확실하지 않아서 MAX + 1 방식으로 처리
	private int getNextUserId() {

		String sql = "SELECT NVL(MAX(USER_ID), 0) + 1 FROM TB_USER";

		try (Connection conn = DBUtil.getConnection();
				PreparedStatement ps = conn.prepareStatement(sql);
				ResultSet rs = ps.executeQuery()) {

			if (rs.next()) {
				return rs.getInt(1);
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return 0;
	}
}