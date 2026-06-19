package com.airnote.filter;

import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.annotation.WebFilter;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@WebFilter("/*")
public class CorsFilter implements Filter {

	private static final Set<String> ALLOWED_ORIGINS = loadAllowedOrigins();

	private static Set<String> loadAllowedOrigins() {
		String configured = System.getenv("AIRNOTE_CORS_ORIGINS");
		if (configured == null || configured.trim().isEmpty()) {
			configured = "http://localhost:5173,http://127.0.0.1:5173";
		}
		return new HashSet<>(Arrays.asList(configured.split("\\s*,\\s*")));
	}

	@Override
	public void init(FilterConfig filterConfig) throws ServletException {
	}

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
			throws IOException, ServletException {

		HttpServletRequest httpRequest = (HttpServletRequest) request;
		HttpServletResponse httpResponse = (HttpServletResponse) response;
		String origin = httpRequest.getHeader("Origin");

		if (ALLOWED_ORIGINS.contains(origin)) {
			httpResponse.setHeader("Access-Control-Allow-Origin", origin);
			httpResponse.setHeader("Vary", "Origin");
			httpResponse.setHeader("Access-Control-Allow-Credentials", "true");
		}

		httpResponse.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
		httpResponse.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
		httpResponse.setHeader("Access-Control-Max-Age", "3600");

		if ("OPTIONS".equalsIgnoreCase(httpRequest.getMethod())) {
			httpResponse.setStatus(HttpServletResponse.SC_OK);
			return;
		}

		chain.doFilter(request, response);
	}

	@Override
	public void destroy() {
	}
}
