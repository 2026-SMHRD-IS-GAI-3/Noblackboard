package com.airnote.controller;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.airnote.model.AnchorMatchLog;
import com.airnote.model.Annotation;
import com.airnote.model.PageAction;
import com.airnote.model.Presentation;
import com.airnote.service.AnchorMatchService;
import com.airnote.service.AnnotationService;
import com.airnote.service.PageActionService;
import com.airnote.service.PresentationService;

@WebServlet("/api/presentations/detail")
public class PresentationDetailController extends HttpServlet {
	private static final long serialVersionUID = 1L;

	private PresentationService presentationService = new PresentationService();
	private AnnotationService annotationService = new AnnotationService();
	private PageActionService pageActionService = new PageActionService();
	private AnchorMatchService anchorMatchService = new AnchorMatchService();

	@Override
	protected void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("application/json; charset=UTF-8");

		int presentationId = Integer.parseInt(request.getParameter("presentationId"));

		Presentation presentation = presentationService.getPresentationDetail(presentationId);

		if (presentation == null) {
			response.getWriter().print("{\"success\":false," + "\"message\":\"발표 기록을 찾을 수 없습니다\"}");
			return;
		}

		List<Annotation> annotations = annotationService.getAnnotationList(presentationId);
		List<PageAction> pageActions = pageActionService.getPageActionList(presentationId);
		List<AnchorMatchLog> anchorMatchLogs = anchorMatchService.getAnchorMatchLogList(presentationId);

		SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

		String startTime = presentation.getStartTime() == null ? "" : sdf.format(presentation.getStartTime());
		String endTime = presentation.getEndTime() == null ? "" : sdf.format(presentation.getEndTime());

		StringBuilder json = new StringBuilder();

		json.append("{");
		json.append("\"success\":true,");
		json.append("\"message\":\"발표 기록 상세 조회 성공\",");
		json.append("\"data\":{");

		json.append("\"presentationId\":").append(presentation.getPresentationId()).append(",");
		json.append("\"userId\":").append(presentation.getUserId()).append(",");
		json.append("\"pdfId\":").append(presentation.getPdfId()).append(",");
		json.append("\"startTime\":\"").append(startTime).append("\",");
		json.append("\"endTime\":\"").append(endTime).append("\",");

		// 판서 기록 목록
		json.append("\"annotations\":[");

		for (int i = 0; i < annotations.size(); i++) {
			Annotation a = annotations.get(i);

			json.append("{");
			json.append("\"annotationId\":").append(a.getAnnotationId()).append(",");
			json.append("\"presentationId\":").append(a.getPresentationId()).append(",");
			json.append("\"pageNo\":").append(a.getPageNo()).append(",");
			json.append("\"toolType\":\"").append(a.getToolType()).append("\",");
			json.append("\"color\":\"").append(a.getColor()).append("\",");
			json.append("\"startX\":").append(a.getStartX()).append(",");
			json.append("\"startY\":").append(a.getStartY()).append(",");
			json.append("\"endX\":").append(a.getEndX()).append(",");
			json.append("\"endY\":").append(a.getEndY()).append(",");

			if (a.getAnchorId() == null) {
				json.append("\"anchorId\":null,");
			} else {
				json.append("\"anchorId\":").append(a.getAnchorId()).append(",");
			}

			if (a.getMatchLogId() == null) {
				json.append("\"matchLogId\":null,");
			} else {
				json.append("\"matchLogId\":").append(a.getMatchLogId()).append(",");
			}

			json.append("\"sourceType\":\"").append(a.getSourceType()).append("\",");

			if (a.getMatchConfidence() == null) {
				json.append("\"matchConfidence\":null");
			} else {
				json.append("\"matchConfidence\":").append(a.getMatchConfidence());
			}

			json.append("}");

			if (i < annotations.size() - 1) {
				json.append(",");
			}
		}

		json.append("],");

		// 페이지 이동 기록 목록
		json.append("\"pageActions\":[");

		for (int i = 0; i < pageActions.size(); i++) {
			PageAction p = pageActions.get(i);

			json.append("{");
			json.append("\"pageActionId\":").append(p.getPageActionId()).append(",");
			json.append("\"presentationId\":").append(p.getPresentationId()).append(",");
			json.append("\"fromPageNo\":").append(p.getFromPageNo()).append(",");
			json.append("\"toPageNo\":").append(p.getToPageNo()).append(",");
			json.append("\"actionType\":\"").append(p.getActionType()).append("\"");
			json.append("}");

			if (i < pageActions.size() - 1) {
				json.append(",");
			}
		}

		json.append("],");

		// 음성 앵커 매칭 로그 목록
		json.append("\"anchorMatchLogs\":[");

		for (int i = 0; i < anchorMatchLogs.size(); i++) {
			AnchorMatchLog log = anchorMatchLogs.get(i);

			json.append("{");
			json.append("\"matchLogId\":").append(log.getMatchLogId()).append(",");
			json.append("\"presentationId\":").append(log.getPresentationId()).append(",");
			json.append("\"pdfId\":").append(log.getPdfId()).append(",");
			json.append("\"pageNo\":").append(log.getPageNo()).append(",");
			json.append("\"sttText\":\"").append(log.getSttText()).append("\",");

			if (log.getSttNormalized() == null) {
				json.append("\"sttNormalized\":null,");
			} else {
				json.append("\"sttNormalized\":\"").append(log.getSttNormalized()).append("\",");
			}

			if (log.getExtractedKeywords() == null) {
				json.append("\"extractedKeywords\":null,");
			} else {
				json.append("\"extractedKeywords\":\"").append(log.getExtractedKeywords()).append("\",");
			}

			if (log.getSttConfidence() == null) {
				json.append("\"sttConfidence\":null,");
			} else {
				json.append("\"sttConfidence\":").append(log.getSttConfidence()).append(",");
			}

			json.append("\"matchStatus\":\"").append(log.getMatchStatus()).append("\",");

			if (log.getSelectedAnchorId() == null) {
				json.append("\"selectedAnchorId\":null,");
			} else {
				json.append("\"selectedAnchorId\":").append(log.getSelectedAnchorId()).append(",");
			}

			if (log.getTopScore() == null) {
				json.append("\"topScore\":null,");
			} else {
				json.append("\"topScore\":").append(log.getTopScore()).append(",");
			}

			if (log.getSecondScore() == null) {
				json.append("\"secondScore\":null,");
			} else {
				json.append("\"secondScore\":").append(log.getSecondScore()).append(",");
			}

			if (log.getScoreGap() == null) {
				json.append("\"scoreGap\":null,");
			} else {
				json.append("\"scoreGap\":").append(log.getScoreGap()).append(",");
			}

			if (log.getCandidateCount() == null) {
				json.append("\"candidateCount\":null,");
			} else {
				json.append("\"candidateCount\":").append(log.getCandidateCount()).append(",");
			}

			if (log.getThresholdScore() == null) {
				json.append("\"thresholdScore\":null,");
			} else {
				json.append("\"thresholdScore\":").append(log.getThresholdScore()).append(",");
			}

			if (log.getAmbiguousGap() == null) {
				json.append("\"ambiguousGap\":null,");
			} else {
				json.append("\"ambiguousGap\":").append(log.getAmbiguousGap()).append(",");
			}

			if (log.getFailReasonCode() == null) {
				json.append("\"failReasonCode\":null,");
			} else {
				json.append("\"failReasonCode\":\"").append(log.getFailReasonCode()).append("\",");
			}

			if (log.getDecisionReason() == null) {
				json.append("\"decisionReason\":null,");
			} else {
				json.append("\"decisionReason\":\"").append(log.getDecisionReason()).append("\",");
			}

			if (log.getMatchAlgorithm() == null) {
				json.append("\"matchAlgorithm\":null,");
			} else {
				json.append("\"matchAlgorithm\":\"").append(log.getMatchAlgorithm()).append("\",");
			}

			if (log.getActionType() == null) {
				json.append("\"actionType\":null,");
			} else {
				json.append("\"actionType\":\"").append(log.getActionType()).append("\",");
			}

			if (log.getProcessTimeMs() == null) {
				json.append("\"processTimeMs\":null");
			} else {
				json.append("\"processTimeMs\":").append(log.getProcessTimeMs());
			}

			json.append("}");

			if (i < anchorMatchLogs.size() - 1) {
				json.append(",");
			}
		}

		json.append("]");

		json.append("}");
		json.append("}");

		response.getWriter().print(json.toString());
	}
}