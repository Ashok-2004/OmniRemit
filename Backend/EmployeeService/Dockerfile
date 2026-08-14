FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["EmployeeService.csproj", "./"]
RUN dotnet restore "EmployeeService.csproj"
COPY . .
RUN dotnet publish "EmployeeService.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8081
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8081
ENTRYPOINT ["dotnet", "EmployeeService.dll"]
