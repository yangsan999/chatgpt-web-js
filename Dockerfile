FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY . /usr/share/nginx/html/
COPY cert.pem /etc/nginx/cert.pem
COPY key.pem /etc/nginx/key.pem