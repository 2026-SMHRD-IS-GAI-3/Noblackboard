package com.airnote.controller;

import java.io.BufferedReader;
import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import com.airnote.common.ApiResponse;
import com.airnote.model.User;
import com.airnote.service.UserService;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

@WebServlet(urlPatterns = { "/api/users/register", "/api/users/login" })
public class UserController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private UserService userService = new UserService();
	private Gson gson = new Gson();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		String uri = request.getRequestURI();

		if (uri.endsWith("/api/users/register")) {
			register(request, response);
			return;
		}

		if (uri.endsWith("/api/users/login")) {
			login(request, response);
			return;
		}

		response.getWriter().write(gson.toJson(ApiResponse.error("지원하지 않는 사용자 요청입니다.")));
	}

	private void register(HttpServletRequest request, HttpServletResponse response) throws IOException {

		try {
			JsonObject json = readJson(request);

			String name = getValue(request, json, "name");
			String email = getValue(request, json, "email");
			String password = getValue(request, json, "password");

			if (name == null || email == null || password == null) {
				response.getWriter().write(gson.toJson(ApiResponse.error("name, email, password가 필요합니다.")));
				return;
			}

			User user = userService.register(name, email, password);

			if (user == null) {
				response.getWriter().write(gson.toJson(ApiResponse.error("회원가입 실패 또는 이미 가입된 이메일입니다.")));
				return;
			}

			response.getWriter().write(gson.toJson(ApiResponse.success("회원가입 성공", user)));

		} catch (Exception e) {
			e.printStackTrace();
			response.getWriter().write(gson.toJson(ApiResponse.error("회원가입 처리 중 오류가 발생했습니다.")));
		}
	}

	private void login(HttpServletRequest request, HttpServletResponse response) throws IOException {

		try {
			JsonObject json = readJson(request);

			String email = getValue(request, json, "email");
			String password = getValue(request, json, "password");

			if (email == null || password == null) {
				response.getWriter().write(gson.toJson(ApiResponse.error("email, password가 필요합니다.")));
				return;
			}

			User user = userService.login(email, password);

			if (user == null) {
				response.getWriter().write(gson.toJson(ApiResponse.error("이메일 또는 비밀번호가 올바르지 않습니다.")));
				return;
			}

			// 세션에도 로그인 사용자 저장
			HttpSession session = request.getSession();
			session.setAttribute("loginUser", user);
			session.setAttribute("userId", user.getUserId());

			response.getWriter().write(gson.toJson(ApiResponse.success("로그인 성공", user)));

		} catch (Exception e) {
			e.printStackTrace();
			response.getWriter().write(gson.toJson(ApiResponse.error("로그인 처리 중 오류가 발생했습니다.")));
		}
	}

	private String getValue(HttpServletRequest request, JsonObject json, String key) {

		String value = request.getParameter(key);

		if (value != null && !value.trim().isEmpty()) {
			return value;
		}

		if (json != null && json.has(key) && !json.get(key).isJsonNull()) {
			return json.get(key).getAsString();
		}

		return null;
	}

	private JsonObject readJson(HttpServletRequest request) throws IOException {

		StringBuilder sb = new StringBuilder();
		String line;

		try (BufferedReader br = request.getReader()) {
			while ((line = br.readLine()) != null) {
				sb.append(line);
			}
		}

		if (sb.length() == 0) {
			return null;
		}

		return gson.fromJson(sb.toString(), JsonObject.class);
	}
}