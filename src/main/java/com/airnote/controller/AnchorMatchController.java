package com.airnote.controller;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.model.AnchorMatchLog;
import com.airnote.service.AnchorMatchService;

// STT 문장과 텍스트 앵커 매칭 로그를 저장하는 컨트롤러

@WebServlet("/api/anchor-match/logs")
public class AnchorMatchController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private AnchorMatchService anchorMatchService = new AnchorMatchService();

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		AnchorMatchLog log = new AnchorMatchLog();

		log.setPresentationId(Integer.parseInt(request.getParameter("presentationId")));
		log.setPdfId(Integer.parseInt(request.getParameter("pdfId")));
		log.setPageNo(Integer.parseInt(request.getParameter("pageNo")));

		log.setSttText(request.getParameter("sttText"));
		log.setSttNormalized(getStringOrNull(request, "sttNormalized"));
		log.setExtractedKeywords(getStringOrNull(request, "extractedKeywords"));
		log.setSttConfidence(getDoubleOrNull(request, "sttConfidence"));

		log.setMatchStatus(request.getParameter("matchStatus"));
		log.setSelectedAnchorId(getIntegerOrNull(request, "selectedAnchorId"));

		log.setTopScore(getDoubleOrNull(request, "topScore"));
		log.setSecondScore(getDoubleOrNull(request, "secondScore"));
		log.setScoreGap(getDoubleOrNull(request, "scoreGap"));
		log.setCandidateCount(getIntegerOrNull(request, "candidateCount"));

		log.setThresholdScore(getDoubleOrNull(request, "thresholdScore"));
		log.setAmbiguousGap(getDoubleOrNull(request, "ambiguousGap"));

		log.setFailReasonCode(getStringOrNull(request, "failReasonCode"));
		log.setDecisionReason(getStringOrNull(request, "decisionReason"));
		log.setMatchAlgorithm(getStringOrNull(request, "matchAlgorithm"));
		log.setActionType(getStringOrNull(request, "actionType"));
		log.setProcessTimeMs(getIntegerOrNull(request, "processTimeMs"));

		int matchLogId = anchorMatchService.saveAnchorMatchLog(log);

		if (matchLogId > 0) {
			response.getWriter().print("{\"success\":true," + "\"message\":\"앵커 매칭 로그 저장 성공\","
					+ "\"data\":{\"matchLogId\":" + matchLogId + "}}");
		} else {
			response.getWriter().print("{\"success\":false," + "\"message\":\"앵커 매칭 로그 저장 실패\"}");
		}
	}

	private String getStringOrNull(HttpServletRequest request, String name) {
		String value = request.getParameter(name);

		if (value == null || value.trim().isEmpty()) {
			return null;
		}

		return value;
	}

	private Integer getIntegerOrNull(HttpServletRequest request, String name) {
		String value = request.getParameter(name);

		if (value == null || value.trim().isEmpty()) {
			return null;
		}

		return Integer.parseInt(value);
	}

	private Double getDoubleOrNull(HttpServletRequest request, String name) {
		String value = request.getParameter(name);

		if (value == null || value.trim().isEmpty()) {
			return null;
		}

		return Double.parseDouble(value);
	}
}