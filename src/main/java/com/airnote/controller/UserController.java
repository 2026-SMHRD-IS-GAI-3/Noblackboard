package com.airnote.controller;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import com.airnote.model.User;
import com.airnote.service.UserService;
import com.airnote.common.ApiServletSupport;

@WebServlet(urlPatterns = { "/api/users/register", "/api/users/login", "/api/users/calibration" })
public class UserController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private UserService userService = new UserService();
	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");

		try {
			String path = request.getServletPath();
			if ("/api/users/register".equals(path)) {
				register(request, response);
			} else if ("/api/users/login".equals(path)) {
				login(request, response);
			} else if ("/api/users/calibration".equals(path)) {
				saveCalibration(request, response);
			} else {
				ApiServletSupport.badRequest(response, "지원하지 않는 요청입니다.");
			}
		} catch (com.google.gson.JsonParseException | IllegalArgumentException error) {
			ApiServletSupport.badRequest(response, "요청 JSON 값을 확인해주세요.");
		} catch (Exception error) {
			error.printStackTrace();
			ApiServletSupport.serverError(response, "사용자 API 처리 중 DB 오류가 발생했습니다.");
		}
	}

	// 회원가입
	private void register(HttpServletRequest request, HttpServletResponse response) throws IOException {

		User requestUser = ApiServletSupport.readJson(request, User.class);
		if (requestUser == null) {
			ApiServletSupport.badRequest(response, "회원가입 JSON 데이터가 필요합니다.");
			return;
		}
		if (userService.emailExists(requestUser.getEmail())) {
			ApiServletSupport.conflict(response, "이미 가입된 이메일입니다.");
			return;
		}

		User user = userService.register(requestUser.getName(), requestUser.getEmail(), requestUser.getPassword());

		if (user == null) {
			ApiServletSupport.badRequest(response, "이름, 이메일, 비밀번호를 확인해주세요.");
			return;
		}

		ApiServletSupport.success(response, "회원가입 성공", user);
	}

	// 로그인
	private void login(HttpServletRequest request, HttpServletResponse response) throws IOException {

		User requestUser = ApiServletSupport.readJson(request, User.class);
		if (requestUser == null) {
			ApiServletSupport.badRequest(response, "로그인 JSON 데이터가 필요합니다.");
			return;
		}

		User user = userService.login(requestUser.getEmail(), requestUser.getPassword());

		if (user == null) {
			ApiServletSupport.write(response, HttpServletResponse.SC_UNAUTHORIZED,
					com.airnote.common.ApiResponse.error("이메일 또는 비밀번호가 일치하지 않습니다.", "LOGIN_FAILED"));
			return;
		}

		HttpSession session = request.getSession();
		session.setAttribute("loginUser", user);
		session.setAttribute("userId", user.getUserId());

		ApiServletSupport.success(response, "로그인 성공", user);
	}

	// 캘리브레이션 저장
	private void saveCalibration(HttpServletRequest request, HttpServletResponse response) throws IOException {

		User user = ApiServletSupport.readJson(request, User.class);
		if (user == null) {
			ApiServletSupport.badRequest(response, "요청 데이터가 없습니다.");
			return;
		}

		boolean result = userService.saveCalibration(user);

		if (!result) {
			ApiServletSupport.badRequest(response, "캘리브레이션 값을 확인해주세요.");
			return;
		}

		Map<String, Object> data = new LinkedHashMap<>();
		data.put("userId", user.getUserId());
		data.put("calibrationYn", "Y");

		ApiServletSupport.success(response, "캘리브레이션 저장 성공", data);
	}
}
