FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Picnivo.API/Picnivo.API.csproj Picnivo.API/
RUN dotnet restore Picnivo.API/Picnivo.API.csproj

COPY Picnivo.API/ Picnivo.API/
RUN dotnet publish Picnivo.API/Picnivo.API.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Picnivo.API.dll"]
