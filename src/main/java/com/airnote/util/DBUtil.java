package com.airnote.util;

// db.properties를 읽어 Oracle DB 연결 객체를 만들어주는 공통 DB 유틸 클래스

import java.io.InputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;

public class DBUtil {

	private static Properties props = new Properties();

	static {
		try {
			InputStream input = DBUtil.class.getClassLoader().getResourceAsStream("db.properties");

			if (input == null) {
				throw new RuntimeException("db.properties 파일을 찾을 수 없습니다.");
			}

			props.load(input);
			Class.forName(props.getProperty("db.driver"));

		} catch (Exception e) {
			throw new RuntimeException("DB 설정 로딩 실패", e);
		}
	}

	public static Connection getConnection() throws Exception {
		String url = setting("AIRNOTE_DB_URL", "db.url");
		String username = setting("AIRNOTE_DB_USERNAME", "db.username");
		String password = setting("AIRNOTE_DB_PASSWORD", "db.password");
		if (url == null || username == null || password == null) {
			throw new IllegalStateException("AIRNOTE_DB_URL, AIRNOTE_DB_USERNAME, AIRNOTE_DB_PASSWORD 설정이 필요합니다.");
		}
		return DriverManager.getConnection(url, username, password);
	}

	private static String setting(String environmentName, String propertyName) {
		String environmentValue = System.getenv(environmentName);
		if (environmentValue != null && !environmentValue.trim().isEmpty()) {
			return environmentValue.trim();
		}
		String propertyValue = props.getProperty(propertyName);
		if (propertyValue == null || propertyValue.trim().isEmpty()) {
			return null;
		}
		return propertyValue.trim();
	}
}
