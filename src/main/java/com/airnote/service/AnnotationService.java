package com.airnote.service;

import java.util.List;

import com.airnote.dao.AnnotationDAO;
import com.airnote.model.Annotation;
import com.airnote.common.SourceType;
import com.airnote.common.ToolType;

public class AnnotationService {

	private AnnotationDAO annotationDAO = new AnnotationDAO();

	public int saveAnnotation(Annotation annotation) {
		if (annotation == null) {
			return 0;
		}

		if (annotation.getPresentationId() <= 0) {
			return 0;
		}

		if (annotation.getPageNo() <= 0) {
			return 0;
		}

		if (isBlank(annotation.getToolType())) {
			return 0;
		}
		if (!ToolType.POINTER.equals(annotation.getToolType())
				&& !ToolType.HIGHLIGHT.equals(annotation.getToolType())
				&& !ToolType.UNDERLINE.equals(annotation.getToolType())
				&& !ToolType.ERASER.equals(annotation.getToolType())) {
			return 0;
		}

		if (isBlank(annotation.getSourceType())) {
			annotation.setSourceType(SourceType.MANUAL);
		}
		if (!SourceType.MANUAL.equals(annotation.getSourceType())
				&& !SourceType.VOICE_START.equals(annotation.getSourceType())) {
			return 0;
		}
		if (SourceType.MANUAL.equals(annotation.getSourceType())) {
			annotation.setAnchorId(null);
			annotation.setMatchLogId(null);
			annotation.setMatchConfidence(null);
		} else {
			if (annotation.getAnchorId() != null && annotation.getAnchorId() <= 0) {
				return 0;
			}
			annotation.setMatchLogId(null);
		}

		return annotationDAO.insertAnnotation(annotation);
	}

	public List<Annotation> getAnnotationList(int presentationId) {
		if (presentationId <= 0) {
			return null;
		}

		return annotationDAO.selectAnnotationList(presentationId);
	}

	public boolean deleteAnnotation(int annotationId, int presentationId, String deleteType) {
		if (annotationId <= 0) {
			return false;
		}

		if (presentationId <= 0) {
			return false;
		}

		if (isBlank(deleteType)) {
			deleteType = "POINTER_HOLD";
		}

		int result = annotationDAO.deleteAnnotation(annotationId, presentationId, deleteType);

		return result > 0;
	}

	private boolean isBlank(String value) {
		return value == null || value.trim().isEmpty();
	}
}
