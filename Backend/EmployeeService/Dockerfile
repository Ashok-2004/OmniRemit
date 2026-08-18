# Build context is Backend/, NOT Backend/EmployeeService/.
#
#   docker build -f EmployeeService/Dockerfile -t omniremit-employee .
#
# Moved to the Backend/ context for consistency with the other two services, which genuinely REQUIRE
# it: their csproj files inherit TargetFramework from Backend/Directory.Build.props and fail with
# NETSDK1013 ("TargetFramework value ''") without it. This project happens to declare net10.0 inline,
# so the older service-folder context did build — but relying on that difference between three
# otherwise identical services is a trap, and inline TargetFramework is itself the anomaly here.
#
# The substantive changes over the previous version: runs as a non-root user, honours the platform's
# $PORT instead of hardcoding 8081, and restores from the manifest layer so source edits do not
# invalidate the package cache.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props ./
COPY EmployeeService/EmployeeService.csproj EmployeeService/
RUN dotnet restore EmployeeService/EmployeeService.csproj

COPY EmployeeService/ EmployeeService/
RUN dotnet publish EmployeeService/EmployeeService.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

USER $APP_UID

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8081

CMD ["sh", "-c", "exec dotnet EmployeeService.dll --urls http://+:${PORT:-8081}"]
