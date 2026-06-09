package com.airnote.service;

import com.airnote.dao.UserDAO;
import com.airnote.model.User;

public class UserService {

	private UserDAO userDAO = new UserDAO();

	// 회원가입
	public User register(String name, String email, String password) {

		if (name == null || name.trim().isEmpty()) {
			return null;
		}

		if (email == null || email.trim().isEmpty()) {
			return null;
		}

		if (password == null || password.trim().isEmpty()) {
			return null;
		}

		// 이미 가입된 이메일이면 회원가입 실패
		if (userDAO.existsByEmail(email)) {
			return null;
		}

		User user = new User();
		user.setName(name);
		user.setEmail(email);
		user.setPassword(password);

		int userId = userDAO.insertUser(user);

		if (userId == 0) {
			return null;
		}

		user.setUserId(userId);

		// 응답에 비밀번호는 보내지 않음
		user.setPassword(null);

		return user;
	}

	// 로그인
	public User login(String email, String password) {

		if (email == null || email.trim().isEmpty()) {
			return null;
		}

		if (password == null || password.trim().isEmpty()) {
			return null;
		}

		User user = userDAO.selectUserByEmailAndPassword(email, password);

		if (user == null) {
			return null;
		}

		// 응답에 비밀번호는 보내지 않음
		user.setPassword(null);

		return user;
	}
}