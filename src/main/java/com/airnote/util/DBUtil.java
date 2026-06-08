package com.airnote.util;

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
		return DriverManager.getConnection(props.getProperty("db.url"), props.getProperty("db.username"),
				props.getProperty("db.password"));
	}
}