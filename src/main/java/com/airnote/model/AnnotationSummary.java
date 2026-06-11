package com.airnote.model;

public class AnnotationSummary {

	private int pointerCount;
	private int highlightCount;
	private int underlineCount;
	private int eraserCount;

	public AnnotationSummary() {
	}

	public int getPointerCount() {
		return pointerCount;
	}

	public void setPointerCount(int pointerCount) {
		this.pointerCount = pointerCount;
	}

	public int getHighlightCount() {
		return highlightCount;
	}

	public void setHighlightCount(int highlightCount) {
		this.highlightCount = highlightCount;
	}

	public int getUnderlineCount() {
		return underlineCount;
	}

	public void setUnderlineCount(int underlineCount) {
		this.underlineCount = underlineCount;
	}

	public int getEraserCount() {
		return eraserCount;
	}

	public void setEraserCount(int eraserCount) {
		this.eraserCount = eraserCount;
	}
}