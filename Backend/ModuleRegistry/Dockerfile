# Build context is Backend/, NOT Backend/ModuleRegistry/ — see AuthService/Dockerfile for why
# (Directory.Build.props holds the TargetFramework and lives one level up).
#
#   docker build -f ModuleRegistry/Dockerfile -t omniremit-registry .

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props ./
COPY ModuleRegistry/ModuleRegistry.csproj ModuleRegistry/
RUN dotnet restore ModuleRegistry/ModuleRegistry.csproj

COPY ModuleRegistry/ ModuleRegistry/
RUN dotnet publish ModuleRegistry/ModuleRegistry.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

USER $APP_UID

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8081

CMD ["sh", "-c", "exec dotnet ModuleRegistry.dll --urls http://+:${PORT:-8081}"]
