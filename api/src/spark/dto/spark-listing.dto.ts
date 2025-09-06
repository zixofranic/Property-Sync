export interface SparkListingDto {
  Id: string;
  StandardFields: {
    ListingId: string;
    ListingKey: string;
    ListPrice: number;
    UnparsedAddress: string;
    City: string;
    StateOrProvince: string;
    PostalCode: string;
    BedsTotal: number;
    BathsTotal: number;
    BuildingAreaTotal: number;
    PropertyType: string;
    PropertySubType: string;
    MlsStatus: string;
    ListAgentName: string;
    ListOfficeName: string;
    PublicRemarks: string;
    ModificationTimestamp: string;
  };
  ResourceUri: string;
}

export interface SparkApiResponse<T> {
  D: {
    Results: T[];
    Success: boolean;
  };
}