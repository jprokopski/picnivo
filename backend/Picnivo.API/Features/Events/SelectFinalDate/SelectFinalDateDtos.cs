namespace Picnivo.API.Features.Events.SelectFinalDate;

public record SelectFinalDateRequest(Guid? DateOptionId, bool Force = false);

public record SelectFinalDateConflictResponse(Guid? CurrentBestDateOptionId);
