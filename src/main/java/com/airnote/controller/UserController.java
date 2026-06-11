package com.airnote.controller;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import com.airnote.model.User;
import com.airnote.service.UserService;
import com.google.gson.Gson;

@WebServlet(urlPatterns = { "/api/users/register", "/api/users/login", "/api/users/calibration" })
public class UserController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private UserService userService = new UserService();
	private Gson gson = new Gson();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		String path = request.getServletPath();

		if ("/api/users/register".equals(path)) {
			register(request, response);
			return;
		}

		if ("/api/users/login".equals(path)) {
			login(request, response);
			return;
		}

		if ("/api/users/calibration".equals(path)) {
			saveCalibration(request, response);
			return;
		}

		writeJson(response, false, "지원하지 않는 요청입니다.", null);
	}

	// 회원가입
	private void register(HttpServletRequest request, HttpServletResponse response) throws IOException {

		String body = readBody(request);

		User requestUser = null;

		if (body != null && !body.trim().isEmpty()) {
			requestUser = gson.fromJson(body, User.class);
		} else {
			requestUser = new User();
			requestUser.setName(request.getParameter("name"));
			requestUser.setEmail(request.getParameter("email"));
			requestUser.setPassword(request.getParameter("password"));
		}

		User user = userService.register(requestUser.getName(), requestUser.getEmail(), requestUser.getPassword());

		if (user == null) {
			writeJson(response, false, "회원가입 실패", null);
			return;
		}

		writeJson(response, true, "회원가입 성공", user);
	}

	// 로그인
	private void login(HttpServletRequest request, HttpServletResponse response) throws IOException {

		String body = readBody(request);

		User requestUser = null;

		if (body != null && !body.trim().isEmpty()) {
			requestUser = gson.fromJson(body, User.class);
		} else {
			requestUser = new User();
			requestUser.setEmail(request.getParameter("email"));
			requestUser.setPassword(request.getParameter("password"));
		}

		User user = userService.login(requestUser.getEmail(), requestUser.getPassword());

		if (user == null) {
			writeJson(response, false, "로그인 실패", null);
			return;
		}

		HttpSession session = request.getSession();
		session.setAttribute("loginUser", user);
		session.setAttribute("userId", user.getUserId());

		writeJson(response, true, "로그인 성공", user);
	}

	// 캘리브레이션 저장
	private void saveCalibration(HttpServletRequest request, HttpServletResponse response) throws IOException {

		String body = readBody(request);

		if (body == null || body.trim().isEmpty()) {
			writeJson(response, false, "요청 데이터가 없습니다.", null);
			return;
		}

		User user = gson.fromJson(body, User.class);

		boolean result = userService.saveCalibration(user);

		if (!result) {
			writeJson(response, false, "캘리브레이션 저장 실패", null);
			return;
		}

		Map<String, Object> data = new HashMap<>();
		data.put("userId", user.getUserId());
		data.put("calibrationYn", "Y");

		writeJson(response, true, "캘리브레이션 저장 성공", data);
	}

	private String readBody(HttpServletRequest request) throws IOException {

		StringBuilder sb = new StringBuilder();

		try (BufferedReader br = request.getReader()) {
			String line;

			while ((line = br.readLine()) != null) {
				sb.append(line);
			}
		}

		return sb.toString();
	}

	private void writeJson(HttpServletResponse response, boolean success, String message, Object data)
			throws IOException {

		Map<String, Object> result = new HashMap<>();
		result.put("success", success);
		result.put("message", message);
		result.put("data", data);

		response.getWriter().write(gson.toJson(result));
	}
}