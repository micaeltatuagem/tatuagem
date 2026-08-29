# Regerar o relatório de auditoria

```bash
python3 -m venv venv
./venv/bin/pip install reportlab matplotlib
cd docs/security-audit
../../venv/bin/python make_charts.py   # gera chart_severidade.png e chart_categoria.png
../../venv/bin/python build_pdf.py     # gera relatorio-auditoria-seguranca.pdf
```

Os achados/textos ficam em `audit_data.py` — edite ali para atualizar o relatório sem mexer no layout.
