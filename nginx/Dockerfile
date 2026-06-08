# Nginx Dockerfile — copies static files from builder stage
FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy built frontend from the multi-stage build
COPY --from=frontend-builder /build/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
