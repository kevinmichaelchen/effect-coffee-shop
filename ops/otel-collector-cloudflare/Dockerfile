FROM otel/opentelemetry-collector-contrib:0.148.0

COPY otelcol/config.yaml /etc/otelcol/config.yaml

EXPOSE 4318
EXPOSE 13133

ENTRYPOINT ["/otelcol-contrib"]
CMD ["--config=/etc/otelcol/config.yaml"]
