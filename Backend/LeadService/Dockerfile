# Use official .NET 10.0 SDK image to build the app
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project file and restore dependencies
COPY ["LeadManagement.Api.csproj", "./"]
RUN dotnet restore "LeadManagement.Api.csproj"

# Copy remaining source code and publish
COPY . .
RUN dotnet publish "LeadManagement.Api.csproj" -c Release -o /app/publish

# Final runtime stage using .NET 10.0 ASP.NET runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Expose port 8080
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "LeadManagement.Api.dll"]
