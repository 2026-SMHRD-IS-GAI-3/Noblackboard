package com.airnote.service;

import com.airnote.dao.UserDAO;
import com.airnote.model.User;

public class UserService {

	private UserDAO userDAO = new UserDAO();

	public boolean emailExists(String email) {
		return email != null && !email.trim().isEmpty() && userDAO.existsByEmail(email.trim());
	}

	// 회원가입
	public User register(String name, String email, String password) {

		if (name == null || name.trim().isEmpty() || name.trim().length() > 50) {
			return null;
		}

		if (email == null || email.trim().isEmpty() || email.trim().length() > 100) {
			return null;
		}

		if (password == null || password.trim().isEmpty() || password.length() > 100) {
			return null;
		}

		// 이미 가입된 이메일이면 회원가입 실패
		if (userDAO.existsByEmail(email.trim())) {
			return null;
		}

		User user = new User();
		user.setName(name.trim());
		user.setEmail(email.trim());
		user.setPassword(password);

		int userId = userDAO.insertUser(user);

		if (userId == 0) {
			return null;
		}

		user.setUserId(userId);

		// 회원가입 직후 기본 캘리브레이션 상태
		user.setCalibrationYn("N");
		user.setCalibrationMirrorYn("N");

		// 응답에 비밀번호는 보내지 않음
		user.setPassword(null);

		return user;
	}

	// 로그인
	public User login(String email, String password) {

		if (email == null || email.trim().isEmpty() || email.trim().length() > 100) {
			return null;
		}

		if (password == null || password.trim().isEmpty() || password.length() > 100) {
			return null;
		}

		User user = userDAO.selectUserByEmailAndPassword(email.trim(), password);

		if (user == null) {
			return null;
		}

		// 응답에 비밀번호는 보내지 않음
		user.setPassword(null);

		return user;
	}

	// 캘리브레이션 저장
	public boolean saveCalibration(User user) {

		if (user == null) {
			return false;
		}

		if (user.getUserId() <= 0) {
			return false;
		}

		// 캘리브레이션 계산값 필수 체크
		if (user.getCalibrationOffsetX() == null) {
			return false;
		}

		if (user.getCalibrationOffsetY() == null) {
			return false;
		}

		if (user.getCalibrationScaleX() == null) {
			return false;
		}

		if (user.getCalibrationScaleY() == null) {
			return false;
		}
		if (user.getCalibrationScaleX() <= 0 || user.getCalibrationScaleY() <= 0) {
			return false;
		}

		// 화면 크기 정보 필수 체크
		if (user.getCameraWidth() == null) {
			return false;
		}

		if (user.getCameraHeight() == null) {
			return false;
		}

		if (user.getCanvasWidth() == null) {
			return false;
		}

		if (user.getCanvasHeight() == null) {
			return false;
		}
		if (user.getCameraWidth() <= 0 || user.getCameraHeight() <= 0
				|| user.getCanvasWidth() <= 0 || user.getCanvasHeight() <= 0) {
			return false;
		}

		// mirror 값이 비어 있으면 기본값 N
		if (user.getCalibrationMirrorYn() == null || user.getCalibrationMirrorYn().trim().isEmpty()) {
			user.setCalibrationMirrorYn("N");
		} else {
			user.setCalibrationMirrorYn(user.getCalibrationMirrorYn().trim().toUpperCase());
		}

		// Y/N 값만 허용
		if (!"Y".equals(user.getCalibrationMirrorYn()) && !"N".equals(user.getCalibrationMirrorYn())) {
			return false;
		}

		int result = userDAO.updateCalibration(user);

		return result > 0;
	}
}
