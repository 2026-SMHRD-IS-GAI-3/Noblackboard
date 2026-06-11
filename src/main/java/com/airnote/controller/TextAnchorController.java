package com.airnote.controller;

import java.io.IOException;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.model.TextAnchor;
import com.airnote.service.TextAnchorService;

// 특정 PDF/페이지의 텍스트 앵커 위치 목록을 조회하는 컨트롤러

@WebServlet("/api/text-anchors")
public class TextAnchorController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private TextAnchorService textAnchorService = new TextAnchorService();

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		int pdfId = Integer.parseInt(request.getParameter("pdfId"));
		int pageNo = Integer.parseInt(request.getParameter("pageNo"));

		List<TextAnchor> anchors = textAnchorService.getTextAnchors(pdfId, pageNo);

		StringBuilder json = new StringBuilder();

		json.append("{");
		json.append("\"success\":true,");
		json.append("\"message\":\"텍스트 앵커 조회 성공\",");
		json.append("\"data\":{");
		json.append("\"pdfId\":").append(pdfId).append(",");
		json.append("\"pageNo\":").append(pageNo).append(",");
		json.append("\"anchors\":[");

		for (int i = 0; i < anchors.size(); i++) {
			TextAnchor a = anchors.get(i);

			json.append("{");
			json.append("\"anchorId\":").append(a.getAnchorId()).append(",");
			json.append("\"textOriginal\":\"").append(a.getTextOriginal()).append("\",");
			json.append("\"textNormalized\":\"").append(a.getTextNormalized()).append("\",");
			json.append("\"keywords\":\"").append(a.getKeywords()).append("\",");
			json.append("\"xRatio\":").append(a.getxRatio()).append(",");
			json.append("\"yRatio\":").append(a.getyRatio()).append(",");
			json.append("\"widthRatio\":").append(a.getWidthRatio()).append(",");
			json.append("\"heightRatio\":").append(a.getHeightRatio()).append(",");
			json.append("\"startXRatio\":").append(a.getStartXRatio()).append(",");
			json.append("\"startYRatio\":").append(a.getStartYRatio()).append(",");
			json.append("\"endXRatio\":").append(a.getEndXRatio()).append(",");
			json.append("\"endYRatio\":").append(a.getEndYRatio()).append(",");
			json.append("\"coordSystem\":\"").append(a.getCoordSystem()).append("\",");
			json.append("\"extractSource\":\"").append(a.getExtractSource()).append("\",");
			json.append("\"confidence\":").append(a.getConfidence());
			json.append("}");

			if (i < anchors.size() - 1) {
				json.append(",");
			}
		}

		json.append("]");
		json.append("}");
		json.append("}");

		response.getWriter().print(json.toString());
	}
}