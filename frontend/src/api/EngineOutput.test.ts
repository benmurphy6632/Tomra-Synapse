import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchEngineOutputs } from "./EngineOutput";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchEngineOutputs", () => {
  it("returns engine outputs from a successful response", async () => {
    const mockOutputs = [
      {
        deviceId: "device-1",
        imageName: "orange.jpg",
        predictedLabel: "orange",
        confidence: 0.95,
        model: "resnet50",
        classId: 950,
        imageURL: "https://example.com/orange.jpg",
      },
    ];

    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: { engineOutputs: mockOutputs } }),
    });

    const result = await fetchEngineOutputs();

    expect(result).toHaveLength(1);
    expect(result[0].predictedLabel).toBe("orange");
    expect(result[0].classId).toBe(950);
  });

  it("returns empty array when data.engineOutputs is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: {} }),
    });

    const result = await fetchEngineOutputs();

    expect(result).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: null }),
    });

    const result = await fetchEngineOutputs();

    expect(result).toEqual([]);
  });

  it("calls the correct GraphQL endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: { engineOutputs: [] } }),
    });

    await fetchEngineOutputs();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/graphql",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends correct Content-Type header", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: { engineOutputs: [] } }),
    });

    await fetchEngineOutputs();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("sends a POST body containing a graphql query", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: { engineOutputs: [] } }),
    });

    await fetchEngineOutputs();

    const callArgs = mockFetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body).toHaveProperty("query");
    expect(typeof body.query).toBe("string");
    expect(body.query).toContain("engineOutputs");
  });

  it("returns multiple outputs correctly", async () => {
    const mockOutputs = [
      {
        deviceId: "dev-1",
        imageName: "a.jpg",
        predictedLabel: "cat",
        confidence: 0.8,
        model: "resnet50",
        classId: 281,
        imageURL: "",
      },
      {
        deviceId: "dev-2",
        imageName: "b.jpg",
        predictedLabel: "dog",
        confidence: 0.9,
        model: "resnet50",
        classId: 207,
        imageURL: "",
      },
    ];

    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: { engineOutputs: mockOutputs } }),
    });

    const result = await fetchEngineOutputs();

    expect(result).toHaveLength(2);
    expect(result[0].predictedLabel).toBe("cat");
    expect(result[1].predictedLabel).toBe("dog");
  });
});
