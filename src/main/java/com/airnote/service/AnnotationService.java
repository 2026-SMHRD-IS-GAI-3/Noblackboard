package com.airnote.service;

import java.util.List;

import com.airnote.dao.AnnotationDAO;
import com.airnote.model.Annotation;

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

		if (isBlank(annotation.getSourceType())) {
			annotation.setSourceType("MANUAL");
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