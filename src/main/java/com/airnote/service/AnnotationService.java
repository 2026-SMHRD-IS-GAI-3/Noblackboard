package com.airnote.service;

import com.airnote.dao.AnnotationDAO;
import com.airnote.model.Annotation;

public class AnnotationService {

	private AnnotationDAO annotationDAO = new AnnotationDAO();

	public int saveAnnotation(Annotation annotation) {
		return annotationDAO.insertAnnotation(annotation);
	}

	public java.util.List<Annotation> getAnnotationList(int presentationId) {
		return annotationDAO.selectAnnotationList(presentationId);
	}
}