#!/bin/bash

# Travelclaw Discord 监听器启动脚本
# 用法：./start-listener.sh [start|stop|status|logs]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/channel-listener.pid"
LOG_FILE="$SCRIPT_DIR/channel-listener.log"
COMMAND="${1:-start}"

start() {
  # 检查是否已在运行
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
      echo "ℹ️  监听进程已在运行 (PID: $PID)"
      echo "📄 日志文件：$LOG_FILE"
      exit 0
    else
      echo "⚠️  发现 stale PID 文件，清理中..."
      rm -f "$PID_FILE"
    fi
  fi

  # 检查依赖
  if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "⚠️  未找到 node_modules，正在安装依赖..."
    cd "$SCRIPT_DIR"
    npm install
  fi

  # 启动进程
  cd "$SCRIPT_DIR"
  nohup node channel-listener.js > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"

  sleep 1
  
  if ps -p $(cat "$PID_FILE") > /dev/null 2>&1; then
    echo "✅ 监听进程已启动 (PID: $(cat $PID_FILE))"
    echo "📄 日志文件：$LOG_FILE"
    echo ""
    echo "💡 提示："
    echo "   - 查看日志：tail -f $LOG_FILE"
    echo "   - 停止服务：$0 stop"
    echo "   - 查看状态：$0 status"
  else
    echo "❌ 启动失败，请检查日志：$LOG_FILE"
    exit 1
  fi
}

stop() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
      echo "⏹️  正在停止监听进程 (PID: $PID)..."
      kill $PID
      sleep 2
      if ps -p $PID > /dev/null 2>&1; then
        echo "⚠️  进程未响应，强制终止..."
        kill -9 $PID
      fi
      rm -f "$PID_FILE"
      echo "✅ 已停止"
    else
      echo "ℹ️  进程未运行，清理 PID 文件"
      rm -f "$PID_FILE"
    fi
  else
    echo "ℹ️  监听进程未运行"
  fi
}

status() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
      echo "✅ 监听进程正在运行 (PID: $PID)"
      echo "📄 日志文件：$LOG_FILE"
      echo ""
      echo "📊 最近日志："
      tail -5 "$LOG_FILE"
    else
      echo "⚠️  PID 文件存在但进程未运行"
    fi
  else
    echo "ℹ️  监听进程未运行"
  fi
}

logs() {
  if [ -f "$LOG_FILE" ]; then
    tail -50 "$LOG_FILE"
  else
    echo "ℹ️  日志文件不存在"
  fi
}

case "$COMMAND" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  status)
    status
    ;;
  logs)
    logs
    ;;
  restart)
    stop
    start
    ;;
  *)
    echo "用法：$0 {start|stop|status|logs|restart}"
    echo ""
    echo "命令说明："
    echo "  start   - 启动监听进程"
    echo "  stop    - 停止监听进程"
    echo "  status  - 查看运行状态"
    echo "  logs    - 查看最近日志"
    echo "  restart - 重启监听进程"
    exit 1
    ;;
esac
