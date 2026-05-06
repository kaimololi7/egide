{{/*
Common labels and helpers for the Egide chart.
*/}}

{{- define "egide.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "egide.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "egide.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "egide.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "egide.labels" -}}
helm.sh/chart: {{ include "egide.chart" . }}
{{ include "egide.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
egide.eu/edition: {{ .Values.global.edition | quote }}
{{- end -}}

{{- define "egide.selectorLabels" -}}
app.kubernetes.io/name: {{ include "egide.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "egide.componentLabels" -}}
{{ include "egide.labels" . }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "egide.image" -}}
{{- $registry := .Values.global.egideImageRegistry -}}
{{- $repo := .repository -}}
{{- $tag := default .Chart.AppVersion .tag -}}
{{- printf "%s/%s:%s" $registry $repo $tag -}}
{{- end -}}

{{- define "egide.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "egide.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}
