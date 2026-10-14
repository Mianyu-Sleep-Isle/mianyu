#!/bin/sh
# 不要在这里猜测正在运行的 Qwen 参数。
# 上机后执行 ps -ef | grep llama，把现有命令原样抄进来，只把 host 改成 127.0.0.1、端口改成 8081。
# 抄完之前 supervisord 里的 llamacpp 必须保持 autostart=false，避免错误命令反复拉起并把现有模型打崩。
echo "llamacpp command is not configured; paste the live llama-server command into deploy/llamacpp.command" >&2
exit 1
