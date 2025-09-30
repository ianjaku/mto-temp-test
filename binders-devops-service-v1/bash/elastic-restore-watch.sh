#!/usr/bin/env bash

NAMESPACE=${1:-develop}
SECRET_NAME="binders-es-elastic-user"
ES_MASTER_POD="binders-es-master-0"

ES_USER="elastic"
ES_PASS=$(kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" -o go-template='{{.data.elastic | base64decode}}')
ES_URL="localhost:9200"

INTERVAL=5

convert_to_seconds() {
	local time=$1
	local unit=${time: -1}

	case $unit in
	"s")
		echo "${time:0:-1}"
		;;
	"m")
		echo "${time:0:-1}" | awk '{print $1 * 60}'
		;;
	*)
		echo "0"
		;;
	esac
}

es_curl() {
	curl_args=(-s -X GET -u "$ES_USER:$ES_PASS" "$ES_URL/$1")
	recovery_status=$(kubectl -n "$NAMESPACE" exec -it "$ES_MASTER_POD" -- curl "${curl_args[@]}")
	echo "$recovery_status"
}

main() {
	last_downloaded=0
	workers=4

	while true; do
		clear

		recovery_status=$(es_curl "_cat/recovery")
		shards_status=$(es_curl "_cat/shards?v=true&h=state")

		total_data_transferred=$(echo "$recovery_status" | awk '{sum += $17} END {print sum / (1024 * 1024)}')
		total_duration_s=$(echo "$recovery_status" | awk '{print $3}' | while read -r line; do
			convert_to_seconds "$line"
		done | awk "{sum += \$1} END {print sum / $workers}")
		average_speed=$(awk "BEGIN {print $total_data_transferred / $total_duration_s}")
		snapshot_name=$(echo "$recovery_status" | tail -n 1 | awk '{print $11}')

		shards_unassigned=$(echo "$shards_status" | grep -c UNASSIGNED)
		shards_started=$(echo "$shards_status" | grep -c STARTED)
		shards_initializing=$(echo "$shards_status" | grep -c INITIALIZING)

		delta_downloaded=$(awk "BEGIN {print $total_data_transferred - $last_downloaded}")
		last_downloaded=$total_data_transferred
		current_speed=$(awk "BEGIN {print $delta_downloaded / $INTERVAL}")

		echo "Snapshot name:        $snapshot_name"
		echo "Currently downloading"
		echo "$recovery_status" | grep -v 'done'
		echo
		echo "Unassigned shards:    $shards_unassigned"
		echo "Started shards:       $shards_started"
		echo "Initializing shards:  $shards_initializing"
		echo
		echo "Total size of transferred data: $total_data_transferred MB"
		echo "Total duration of recovery:     $total_duration_s seconds"
		echo "Average speed:                  $average_speed MB/s"
		echo "Current speed:                  $current_speed MB/s"

		sleep $INTERVAL
	done
}

main
