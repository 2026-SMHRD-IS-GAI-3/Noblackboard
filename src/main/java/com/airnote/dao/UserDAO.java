package com.airnote.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;

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
				+ "    JOIN_DATE, " + "    CALIBRATION_YN, " + "    CALIBRATION_MIRROR_YN " + ") VALUES (" + "    ?, "
				+ "    ?, " + "    ?, " + "    ?, " + "    SYSDATE, " + "    'N', " + "    'N' " + ")";

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
				+ "    TO_CHAR(JOIN_DATE, 'YYYY-MM-DD HH24:MI:SS') AS JOIN_DATE, " + "    CALIBRATION_YN, "
				+ "    CALIBRATION_OFFSET_X, " + "    CALIBRATION_OFFSET_Y, " + "    CALIBRATION_SCALE_X, "
				+ "    CALIBRATION_SCALE_Y, " + "    CALIBRATION_MIRROR_YN, " + "    CAMERA_WIDTH, "
				+ "    CAMERA_HEIGHT, " + "    CANVAS_WIDTH, " + "    CANVAS_HEIGHT, "
				+ "    TO_CHAR(CALIBRATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CALIBRATED_AT " + "FROM TB_USER "
				+ "WHERE EMAIL = ? " + "AND PASSWORD = ?";

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

					user.setCalibrationYn(rs.getString("CALIBRATION_YN"));
					user.setCalibrationOffsetX(getNullableDouble(rs, "CALIBRATION_OFFSET_X"));
					user.setCalibrationOffsetY(getNullableDouble(rs, "CALIBRATION_OFFSET_Y"));
					user.setCalibrationScaleX(getNullableDouble(rs, "CALIBRATION_SCALE_X"));
					user.setCalibrationScaleY(getNullableDouble(rs, "CALIBRATION_SCALE_Y"));
					user.setCalibrationMirrorYn(rs.getString("CALIBRATION_MIRROR_YN"));
					user.setCameraWidth(getNullableInt(rs, "CAMERA_WIDTH"));
					user.setCameraHeight(getNullableInt(rs, "CAMERA_HEIGHT"));
					user.setCanvasWidth(getNullableInt(rs, "CANVAS_WIDTH"));
					user.setCanvasHeight(getNullableInt(rs, "CANVAS_HEIGHT"));
					user.setCalibratedAt(rs.getString("CALIBRATED_AT"));

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

	// 캘리브레이션 저장
	public int updateCalibration(User user) {

		String sql = "" + "UPDATE TB_USER " + "SET CALIBRATION_YN = 'Y', " + "    CALIBRATION_OFFSET_X = ?, "
				+ "    CALIBRATION_OFFSET_Y = ?, " + "    CALIBRATION_SCALE_X = ?, " + "    CALIBRATION_SCALE_Y = ?, "
				+ "    CALIBRATION_MIRROR_YN = ?, " + "    CAMERA_WIDTH = ?, " + "    CAMERA_HEIGHT = ?, "
				+ "    CANVAS_WIDTH = ?, " + "    CANVAS_HEIGHT = ?, " + "    CALIBRATED_AT = SYSDATE "
				+ "WHERE USER_ID = ?";

		try (Connection conn = DBUtil.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {

			setNullableDouble(ps, 1, user.getCalibrationOffsetX());
			setNullableDouble(ps, 2, user.getCalibrationOffsetY());
			setNullableDouble(ps, 3, user.getCalibrationScaleX());
			setNullableDouble(ps, 4, user.getCalibrationScaleY());

			if (user.getCalibrationMirrorYn() == null || user.getCalibrationMirrorYn().trim().isEmpty()) {
				ps.setString(5, "N");
			} else {
				ps.setString(5, user.getCalibrationMirrorYn());
			}

			setNullableInt(ps, 6, user.getCameraWidth());
			setNullableInt(ps, 7, user.getCameraHeight());
			setNullableInt(ps, 8, user.getCanvasWidth());
			setNullableInt(ps, 9, user.getCanvasHeight());

			ps.setInt(10, user.getUserId());

			return ps.executeUpdate();

		} catch (Exception e) {
			e.printStackTrace();
			return 0;
		}
	}

	// NUMBER 컬럼에 null 저장 가능하게 처리
	private void setNullableDouble(PreparedStatement ps, int index, Double value) throws Exception {
		if (value == null) {
			ps.setNull(index, Types.NUMERIC);
		} else {
			ps.setDouble(index, value);
		}
	}

	// NUMBER 컬럼에 null 저장 가능하게 처리
	private void setNullableInt(PreparedStatement ps, int index, Integer value) throws Exception {
		if (value == null) {
			ps.setNull(index, Types.NUMERIC);
		} else {
			ps.setInt(index, value);
		}
	}

	// DB NUMBER null이면 Java에서도 null로 받기
	private Double getNullableDouble(ResultSet rs, String columnName) throws Exception {
		double value = rs.getDouble(columnName);

		if (rs.wasNull()) {
			return null;
		}

		return value;
	}

	// DB NUMBER null이면 Java에서도 null로 받기
	private Integer getNullableInt(ResultSet rs, String columnName) throws Exception {
		int value = rs.getInt(columnName);

		if (rs.wasNull()) {
			return null;
		}

		return value;
	}
}