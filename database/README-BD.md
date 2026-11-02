# Orden de ejecución de la base de datos

Ejecuta los archivos en este orden:

1. `connection.sql` como `root`. Este es el único paso que requiere el usuario `root`.
2. `schema.sql` como `paulo_user`.
3. `rbac.sql` como `paulo_user`.
4. Registra primero un usuario desde la aplicación o desde Postman; después ejecuta `04_hacer_admin.sql` como `paulo_user`.
5. Ejecuta `05_datos_prueba.sql` como `paulo_user`.
6. Ejecuta `00_verificacion.sql` como `paulo_user`.

Los pasos 2 a 6 se ejecutan con `paulo_user`, usando la base de datos `gestion_tareas_sena`.