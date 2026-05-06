{{/*
Generic component deployment template.
Usage:
  {{- include "egide.componentDeployment" (dict "name" "validator" "values" .Values.validator "root" .) }}

The included template renders Deployment + Service together for one
component. All components share the same securityContext defaults from
api.podSecurityContext / api.containerSecurityContext if their own keys
are unset (handled by `default` calls in the template).
*/}}

{{- define "egide.componentDeployment" -}}
{{- $name := .name -}}
{{- $values := .values -}}
{{- $root := .root -}}
{{- $podSec := default $root.Values.api.podSecurityContext $values.podSecurityContext -}}
{{- $ctrSec := default $root.Values.api.containerSecurityContext $values.containerSecurityContext -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "egide.fullname" $root }}-{{ $name }}
  labels: {{- include "egide.componentLabels" (merge (dict "component" $name) $root) | nindent 4 }}
spec:
  replicas: {{ $values.replicaCount }}
  selector:
    matchLabels: {{- include "egide.selectorLabels" $root | nindent 6 }}
      app.kubernetes.io/component: {{ $name }}
  template:
    metadata:
      labels: {{- include "egide.selectorLabels" $root | nindent 8 }}
        app.kubernetes.io/component: {{ $name }}
      {{- with $root.Values.podAnnotations }}
      annotations: {{- toYaml . | nindent 8 }}
      {{- end }}
    spec:
      serviceAccountName: {{ include "egide.serviceAccountName" $root }}
      {{- with $root.Values.global.imagePullSecrets }}
      imagePullSecrets: {{- toYaml . | nindent 8 }}
      {{- end }}
      securityContext: {{- toYaml $podSec | nindent 8 }}
      containers:
        - name: {{ $name }}
          image: {{ include "egide.image" (merge (dict "repository" $values.image.repository "tag" $values.image.tag) $root) }}
          imagePullPolicy: {{ $values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ $values.service.port }}
          envFrom:
            - secretRef:
                name: {{ include "egide.fullname" $root }}-config
          {{- with $values.env }}
          env: {{- toYaml . | nindent 12 }}
          {{- end }}
          livenessProbe:
            httpGet: { path: /health, port: http }
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet: { path: /health, port: http }
            initialDelaySeconds: 5
            periodSeconds: 5
          resources: {{- toYaml $values.resources | nindent 12 }}
          securityContext: {{- toYaml $ctrSec | nindent 12 }}
          volumeMounts:
            - { name: tmp, mountPath: /tmp }
      volumes:
        - { name: tmp, emptyDir: {} }
---
apiVersion: v1
kind: Service
metadata:
  name: {{ include "egide.fullname" $root }}-{{ $name }}
  labels: {{- include "egide.componentLabels" (merge (dict "component" $name) $root) | nindent 4 }}
spec:
  type: {{ $values.service.type }}
  selector: {{- include "egide.selectorLabels" $root | nindent 4 }}
    app.kubernetes.io/component: {{ $name }}
  ports:
    - { name: http, port: {{ $values.service.port }}, targetPort: http }
{{- end -}}
