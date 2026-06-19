package com.airnote.controller;

import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.common.ApiServletSupport;
import com.airnote.model.TextAnchor;
import com.airnote.service.TextAnchorService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// 특정 PDF/페이지의 텍스트 앵커 위치 목록을 조회하는 컨트롤러

@WebServlet("/api/text-anchors")
public class TextAnchorController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private TextAnchorService textAnchorService = new TextAnchorService();

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		try {
			int pdfId = ApiServletSupport.requirePositiveInt("pdfId", request.getParameter("pdfId"));
			int pageNo = ApiServletSupport.requirePositiveInt("pageNo", request.getParameter("pageNo"));
			List<TextAnchor> anchors = textAnchorService.getTextAnchors(pdfId, pageNo);
			Map<String, Object> data = new LinkedHashMap<>();
			data.put("pdfId", pdfId);
			data.put("pageNo", pageNo);
			data.put("anchors", anchors);
			ApiServletSupport.success(response, "텍스트 앵커 조회 성공", data);
		} catch (IllegalArgumentException error) {
			ApiServletSupport.badRequest(response, error.getMessage());
		} catch (Exception error) {
			error.printStackTrace();
			ApiServletSupport.serverError(response, "텍스트 앵커 조회 중 오류가 발생했습니다.");
		}
	}
}
