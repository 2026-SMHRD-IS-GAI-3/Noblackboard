package com.airnote.model;

import java.util.Date;

public class SlideViewLog {

	private int slideViewId;
	private int presentationId;
	private int pageNo;
	private Date enterTime;
	private Date exitTime;
	private int durationSec;
	private Date createdAt;

	public SlideViewLog() {
	}

	public int getSlideViewId() {
		return slideViewId;
	}

	public void setSlideViewId(int slideViewId) {
		this.slideViewId = slideViewId;
	}

	public int getPresentationId() {
		return presentationId;
	}

	public void setPresentationId(int presentationId) {
		this.presentationId = presentationId;
	}

	public int getPageNo() {
		return pageNo;
	}

	public void setPageNo(int pageNo) {
		this.pageNo = pageNo;
	}

	public Date getEnterTime() {
		return enterTime;
	}

	public void setEnterTime(Date enterTime) {
		this.enterTime = enterTime;
	}

	public Date getExitTime() {
		return exitTime;
	}

	public void setExitTime(Date exitTime) {
		this.exitTime = exitTime;
	}

	public int getDurationSec() {
		return durationSec;
	}

	public void setDurationSec(int durationSec) {
		this.durationSec = durationSec;
	}

	public Date getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Date createdAt) {
		this.createdAt = createdAt;
	}
}