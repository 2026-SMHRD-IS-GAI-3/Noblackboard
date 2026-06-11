package com.airnote.model;

public class SlideDuration {

	private int pageNo;
	private int durationSec;

	public SlideDuration() {
	}

	public SlideDuration(int pageNo, int durationSec) {
		this.pageNo = pageNo;
		this.durationSec = durationSec;
	}

	public int getPageNo() {
		return pageNo;
	}

	public void setPageNo(int pageNo) {
		this.pageNo = pageNo;
	}

	public int getDurationSec() {
		return durationSec;
	}

	public void setDurationSec(int durationSec) {
		this.durationSec = durationSec;
	}
}