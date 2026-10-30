# Pasta de Templates Excel (`public/templates`)

Coloque nesta pasta (`public/templates/`) os ficheiros modelo Excel (`.xlsx`) utilizados para exportação de dados na plataforma **PlatFarmaSupa**.

## Como aceder aos templates no código:
- **No Browser (Client Components)**: `fetch('/templates/nome_do_template.xlsx')`
- **No Servidor (Server Actions / Route Handlers)**: `path.join(process.cwd(), 'public', 'templates', 'nome_do_template.xlsx')`

