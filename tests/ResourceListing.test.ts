import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Listing {
  owner: string;
  resourceType: string;
  quantity: number;
  unit: string;
  location: string;
  expiration?: number;
  price?: number;
  description: string;
  status: string;
  createdAt: number;
  lastUpdated: number;
  metadata?: string;
}

interface Category {
  category: string;
  tags: string[];
}

interface Collaborator {
  role: string;
  permissions: string[];
  addedAt: number;
}

interface UpdateHistory {
  updater: string;
  notes: string;
  timestamp: number;
  changes: { field: string; value: string }[];
}

interface Verification {
  verifiedBy?: string;
  verificationNotes?: string;
  verifiedAt?: number;
}

interface ContractState {
  paused: boolean;
  admin: string;
  nextListingId: number;
  listings: Map<number, Listing>;
  categories: Map<number, Category>;
  collaborators: Map<string, Collaborator>; // Key: `${listingId}-${collaborator}`
  updateHistory: Map<string, UpdateHistory>; // Key: `${listingId}-${updateId}`
  verifications: Map<number, Verification>;
}

// Mock contract implementation
class ResourceListingMock {
  private state: ContractState = {
    paused: false,
    admin: "deployer",
    nextListingId: 1,
    listings: new Map(),
    categories: new Map(),
    collaborators: new Map(),
    updateHistory: new Map(),
    verifications: new Map(),
  };

  private ERR_UNAUTHORIZED = 100;
  private ERR_INVALID_LISTING = 101;
  private ERR_ALREADY_EXISTS = 102;
  private ERR_INVALID_PARAM = 103;
  private ERR_PAUSED = 104;
  private ERR_EXPIRED = 105;
  private ERR_MAX_TAGS = 106;
  private ERR_MAX_COLLABORATORS = 107;
  private ERR_NOT_OWNER = 108;
  private ERR_INVALID_STATUS = 109;
  private MAX_TAGS = 10;
  private MAX_COLLABORATORS = 5;
  private MAX_METADATA_LEN = 500;
  private MAX_DESCRIPTION_LEN = 1000;
  private MAX_LOCATION_LEN = 100;
  private MAX_UPDATE_NOTES_LEN = 200;

  private currentBlockHeight = 100; // Mock block height

  // Simulate block height increase
  private incrementBlockHeight() {
    this.currentBlockHeight += 1;
  }

  getNextListingId(): ClarityResponse<number> {
    return { ok: true, value: this.state.nextListingId };
  }

  getListing(listingId: number): ClarityResponse<Listing | null> {
    return { ok: true, value: this.state.listings.get(listingId) ?? null };
  }

  getListingCategories(listingId: number): ClarityResponse<Category | null> {
    return { ok: true, value: this.state.categories.get(listingId) ?? null };
  }

  getListingCollaborator(listingId: number, collaborator: string): ClarityResponse<Collaborator | null> {
    const key = `${listingId}-${collaborator}`;
    return { ok: true, value: this.state.collaborators.get(key) ?? null };
  }

  getListingUpdate(listingId: number, updateId: number): ClarityResponse<UpdateHistory | null> {
    const key = `${listingId}-${updateId}`;
    return { ok: true, value: this.state.updateHistory.get(key) ?? null };
  }

  getListingVerification(listingId: number): ClarityResponse<Verification | null> {
    return { ok: true, value: this.state.verifications.get(listingId) ?? null };
  }

  isContractPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getContractAdmin(): ClarityResponse<string> {
    return { ok: true, value: this.state.admin };
  }

  hasPermission(listingId: number, caller: string, permission: string): ClarityResponse<boolean> {
    const listing = this.state.listings.get(listingId);
    if (!listing) return { ok: true, value: false };
    const collabKey = `${listingId}-${caller}`;
    const collab = this.state.collaborators.get(collabKey);
    const isOwner = listing.owner === caller;
    const hasPerm = collab && collab.permissions.includes(permission);
    return { ok: true, value: isOwner || !!hasPerm };
  }

  createListing(
    caller: string,
    resourceType: string,
    quantity: number,
    unit: string,
    location: string,
    expiration?: number,
    price?: number,
    description: string = "",
    category: string = "",
    tags: string[] = [],
    metadata?: string
  ): ClarityResponse<number> {
    if (this.state.paused) return { ok: false, value: this.ERR_PAUSED };
    if (quantity <= 0) return { ok: false, value: this.ERR_INVALID_PARAM };
    if (tags.length > this.MAX_TAGS) return { ok: false, value: this.ERR_MAX_TAGS };
    if (description.length > this.MAX_DESCRIPTION_LEN) return { ok: false, value: this.ERR_INVALID_PARAM };
    if (location.length > this.MAX_LOCATION_LEN) return { ok: false, value: this.ERR_INVALID_PARAM };
    if (metadata && metadata.length > this.MAX_METADATA_LEN) return { ok: false, value: this.ERR_INVALID_PARAM };

    const listingId = this.state.nextListingId;
    this.state.listings.set(listingId, {
      owner: caller,
      resourceType,
      quantity,
      unit,
      location,
      expiration,
      price,
      description,
      status: "active",
      createdAt: this.currentBlockHeight,
      lastUpdated: this.currentBlockHeight,
      metadata,
    });
    this.state.categories.set(listingId, { category, tags });
    this.state.nextListingId += 1;
    this.incrementBlockHeight();
    return { ok: true, value: listingId };
  }

  updateListing(
    caller: string,
    listingId: number,
    newQuantity?: number,
    newLocation?: string,
    newExpiration?: number,
    newPrice?: number,
    newDescription?: string,
    newMetadata?: string,
    notes: string = ""
  ): ClarityResponse<boolean> {
    if (this.state.paused) return { ok: false, value: this.ERR_PAUSED };
    const listing = this.state.listings.get(listingId);
    if (!listing) return { ok: false, value: this.ERR_INVALID_LISTING };
    const hasPermRes = this.hasPermission(listingId, caller, "update");
    if (!hasPermRes.value) return { ok: false, value: this.ERR_UNAUTHORIZED };
    if (listing.status !== "active") return { ok: false, value: this.ERR_INVALID_STATUS };
    if (newExpiration && newExpiration <= this.currentBlockHeight) return { ok: false, value: this.ERR_EXPIRED };

    const updatedListing = {
      ...listing,
      quantity: newQuantity ?? listing.quantity,
      location: newLocation ?? listing.location,
      expiration: newExpiration ?? listing.expiration,
      price: newPrice ?? listing.price,
      description: newDescription ?? listing.description,
      metadata: newMetadata ?? listing.metadata,
      lastUpdated: this.currentBlockHeight,
    };
    this.state.listings.set(listingId, updatedListing);

    // Simplified update id - assume we count existing updates
    const updateKeys = Array.from(this.state.updateHistory.keys()).filter(k => k.startsWith(`${listingId}-`));
    const updateId = updateKeys.length + 1;
    const key = `${listingId}-${updateId}`;
    this.state.updateHistory.set(key, {
      updater: caller,
      notes,
      timestamp: this.currentBlockHeight,
      changes: [], // Mocked, no actual changes tracked here
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  cancelListing(caller: string, listingId: number): ClarityResponse<boolean> {
    if (this.state.paused) return { ok: false, value: this.ERR_PAUSED };
    const listing = this.state.listings.get(listingId);
    if (!listing) return { ok: false, value: this.ERR_INVALID_LISTING };
    const hasPermRes = this.hasPermission(listingId, caller, "cancel");
    if (!hasPermRes.value) return { ok: false, value: this.ERR_UNAUTHORIZED };
    if (listing.status !== "active") return { ok: false, value: this.ERR_INVALID_STATUS };

    this.state.listings.set(listingId, { ...listing, status: "cancelled" });
    return { ok: true, value: true };
  }

  addCollaborator(
    caller: string,
    listingId: number,
    collaborator: string,
    role: string,
    permissions: string[]
  ): ClarityResponse<boolean> {
    if (this.state.paused) return { ok: false, value: this.ERR_PAUSED };
    const listing = this.state.listings.get(listingId);
    if (!listing) return { ok: false, value: this.ERR_INVALID_LISTING };
    if (listing.owner !== caller) return { ok: false, value: this.ERR_NOT_OWNER };
    if (permissions.length > this.MAX_COLLABORATORS) return { ok: false, value: this.ERR_MAX_COLLABORATORS };
    const key = `${listingId}-${collaborator}`;
    if (this.state.collaborators.has(key)) return { ok: false, value: this.ERR_ALREADY_EXISTS };

    this.state.collaborators.set(key, {
      role,
      permissions,
      addedAt: this.currentBlockHeight,
    });
    return { ok: true, value: true };
  }

  verifyListing(caller: string, listingId: number, notes: string): ClarityResponse<boolean> {
    if (this.state.paused) return { ok: false, value: this.ERR_PAUSED };
    const listing = this.state.listings.get(listingId);
    if (!listing) return { ok: false, value: this.ERR_INVALID_LISTING };
    if (listing.owner === caller) return { ok: false, value: this.ERR_UNAUTHORIZED };

    this.state.verifications.set(listingId, {
      verifiedBy: caller,
      verificationNotes: notes,
      verifiedAt: this.currentBlockHeight,
    });
    return { ok: true, value: true };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) return { ok: false, value: this.ERR_UNAUTHORIZED };
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) return { ok: false, value: this.ERR_UNAUTHORIZED };
    this.state.paused = false;
    return { ok: true, value: true };
  }

  setAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) return { ok: false, value: this.ERR_UNAUTHORIZED };
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  ngo1: "ngo_1",
  ngo2: "ngo_2",
  verifier: "verifier",
};

describe("ResourceListing Contract", () => {
  let contract: ResourceListingMock;

  beforeEach(() => {
    contract = new ResourceListingMock();
    vi.resetAllMocks();
  });

  it("should initialize with correct defaults", () => {
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });
    expect(contract.getContractAdmin()).toEqual({ ok: true, value: accounts.deployer });
    expect(contract.getNextListingId()).toEqual({ ok: true, value: 1 });
  });

  it("should allow NGO to create a listing", () => {
    const createRes = contract.createListing(
      accounts.ngo1,
      "food",
      1000,
      "kg",
      "New York",
      200,
      500,
      "Surplus canned goods",
      "essentials",
      ["non-perishable", "donation"],
      "{\"quality\": \"high\"}"
    );
    expect(createRes).toEqual({ ok: true, value: 1 });

    const listing = contract.getListing(1);
    expect(listing.value).toEqual(expect.objectContaining({
      owner: accounts.ngo1,
      resourceType: "food",
      quantity: 1000,
      status: "active",
    }));

    const categories = contract.getListingCategories(1);
    expect(categories.value).toEqual({ category: "essentials", tags: ["non-perishable", "donation"] });
  });

  it("should prevent creation with invalid params", () => {
    const invalidQuantity = contract.createListing(accounts.ngo1, "food", 0, "kg", "Location", undefined, undefined, "");
    expect(invalidQuantity).toEqual({ ok: false, value: 103 });

    const tooManyTags = contract.createListing(
      accounts.ngo1,
      "food",
      1000,
      "kg",
      "Location",
      undefined,
      undefined,
      "",
      "",
      Array(11).fill("tag")
    );
    expect(tooManyTags).toEqual({ ok: false, value: 106 });
  });

  it("should allow owner to update listing", () => {
    contract.createListing(accounts.ngo1, "food", 1000, "kg", "New York", undefined, undefined, "Desc");

    const updateRes = contract.updateListing(
      accounts.ngo1,
      1,
      500,
      "Boston",
      undefined,
      600,
      "Updated desc",
      "{\"new\": \"meta\"}",
      "Quantity reduced"
    );
    expect(updateRes).toEqual({ ok: true, value: true });

    const updatedListing = contract.getListing(1);
    expect(updatedListing.value).toEqual(expect.objectContaining({
      quantity: 500,
      location: "Boston",
      price: 600,
      description: "Updated desc",
      metadata: "{\"new\": \"meta\"}",
    }));

    const updateHistory = contract.getListingUpdate(1, 1);
    expect(updateHistory.value).toEqual(expect.objectContaining({
      updater: accounts.ngo1,
      notes: "Quantity reduced",
    }));
  });

  it("should prevent unauthorized update", () => {
    contract.createListing(accounts.ngo1, "food", 1000, "kg", "Location", undefined, undefined, "");

    const unauthorizedUpdate = contract.updateListing(accounts.ngo2, 1, 500);
    expect(unauthorizedUpdate).toEqual({ ok: false, value: 100 });
  });

  it("should allow adding collaborator and check permissions", () => {
    contract.createListing(accounts.ngo1, "food", 1000, "kg", "Location", undefined, undefined, "");

    const addCollab = contract.addCollaborator(
      accounts.ngo1,
      1,
      accounts.ngo2,
      "logistics",
      ["update", "cancel"]
    );
    expect(addCollab).toEqual({ ok: true, value: true });

    const collab = contract.getListingCollaborator(1, accounts.ngo2);
    expect(collab.value).toEqual(expect.objectContaining({
      role: "logistics",
      permissions: ["update", "cancel"],
    }));

    const hasUpdatePerm = contract.hasPermission(1, accounts.ngo2, "update");
    expect(hasUpdatePerm).toEqual({ ok: true, value: true });

    const hasNoPerm = contract.hasPermission(1, accounts.ngo2, "unknown");
    expect(hasNoPerm).toEqual({ ok: true, value: false });
  });

  it("should allow verifier to verify listing", () => {
    contract.createListing(accounts.ngo1, "food", 1000, "kg", "Location", undefined, undefined, "");

    const verifyRes = contract.verifyListing(accounts.verifier, 1, "Verified quality");
    expect(verifyRes).toEqual({ ok: true, value: true });

    const verification = contract.getListingVerification(1);
    expect(verification.value).toEqual(expect.objectContaining({
      verifiedBy: accounts.verifier,
      verificationNotes: "Verified quality",
    }));
  });

  it("should prevent owner from verifying own listing", () => {
    contract.createListing(accounts.ngo1, "food", 1000, "kg", "Location", undefined, undefined, "");

    const selfVerify = contract.verifyListing(accounts.ngo1, 1, "Self verify");
    expect(selfVerify).toEqual({ ok: false, value: 100 });
  });

  it("should allow admin to pause and unpause", () => {
    const pauseRes = contract.pauseContract(accounts.deployer);
    expect(pauseRes).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: true });

    const createDuringPause = contract.createListing(accounts.ngo1, "food", 1000, "kg", "Location");
    expect(createDuringPause).toEqual({ ok: false, value: 104 });

    const unpauseRes = contract.unpauseContract(accounts.deployer);
    expect(unpauseRes).toEqual({ ok: true, value: true });
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });
  });

  it("should prevent non-admin from pausing", () => {
    const pauseRes = contract.pauseContract(accounts.ngo1);
    expect(pauseRes).toEqual({ ok: false, value: 100 });
  });

  it("should allow cancelling active listing", () => {
    contract.createListing(accounts.ngo1, "food", 1000, "kg", "Location", undefined, undefined, "");

    const cancelRes = contract.cancelListing(accounts.ngo1, 1);
    expect(cancelRes).toEqual({ ok: true, value: true });

    const listing = contract.getListing(1);
    expect(listing.value?.status).toBe("cancelled");
  });

  it("should prevent cancelling non-active listing", () => {
    contract.createListing(accounts.ngo1, "food", 1000, "kg", "Location", undefined, undefined, "");
    contract.cancelListing(accounts.ngo1, 1);

    const recancel = contract.cancelListing(accounts.ngo1, 1);
    expect(recancel).toEqual({ ok: false, value: 109 });
  });
});