package com.airnote.model;

// 페이지 이동 전후 번호와 이동 종류를 담는 모델 클래스

public class PageAction {

	private int pageActionId;
	private int presentationId;
	private int fromPageNo;
	private int toPageNo;
	private String actionType;

	public int getPageActionId() {
		return pageActionId;
	}

	public void setPageActionId(int pageActionId) {
		this.pageActionId = pageActionId;
	}

	public int getPresentationId() {
		return presentationId;
	}

	public void setPresentationId(int presentationId) {
		this.presentationId = presentationId;
	}

	public int getFromPageNo() {
		return fromPageNo;
	}

	public void setFromPageNo(int fromPageNo) {
		this.fromPageNo = fromPageNo;
	}

	public int getToPageNo() {
		return toPageNo;
	}

	public void setToPageNo(int toPageNo) {
		this.toPageNo = toPageNo;
	}

	public String getActionType() {
		return actionType;
	}

	public void setActionType(String actionType) {
		this.actionType = actionType;
	}
}