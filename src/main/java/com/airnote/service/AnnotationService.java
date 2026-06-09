package com.airnote.service;

import com.airnote.dao.AnnotationDAO;
import com.airnote.model.Annotation;

// 실제 판서,도구 사용 결과 저장 기능을 처리하는 서비스

public class AnnotationService {

	private AnnotationDAO annotationDAO = new AnnotationDAO();

	public int saveAnnotation(Annotation annotation) {
		return annotationDAO.insertAnnotation(annotation);
	}

	public java.util.List<Annotation> getAnnotationList(int presentationId) {
		return annotationDAO.selectAnnotationList(presentationId);
	}
}