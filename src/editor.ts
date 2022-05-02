import { ethers } from "ethers";
import { CurrencyAmount, Percent, Token, TradeType } from "@uniswap/sdk-core";
import { Pool, Route, Trade } from "@uniswap/v3-sdk";
import { abi as UniswapV3Factory } from "@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json";
import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";

import {
    IEezFlowEditor,
    IVariable,
    GenericDialogResult,
    IObjectVariableValueConstructorParams
} from "eez-studio-types";

export default {
    eezFlowExtensionInit: (eezFlowEditor: IEezFlowEditor) => {
        const {
            registerActionComponent,
            registerObjectVariableType,
            showGenericDialog,
            validators
        } = eezFlowEditor;

        ////////////////////////////////////////////////////////////////////////////////

        const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M0 0h24v24H0z" stroke="none"/><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3M12 12l8-4.5M12 12v9M12 12 4 7.5M16 5.25l-8 4.5"/></svg>`;

        ////////////////////////////////////////////////////////////////////////////////

        registerActionComponent({
            name: "GetPoolAddress",

            icon: ICON,

            componentHeaderColor: "#FFCC66",

            bodyPropertyName: undefined,

            inputs: [],

            outputs: [],

            properties: [
                {
                    name: "provider",
                    type: "expression",
                    valueType: "object:eez-flow-ext-uniswap/EtherumProvider"
                },
                {
                    name: "token0",
                    type: "expression",
                    valueType: "string"
                },
                {
                    name: "token1",
                    type: "expression",
                    valueType: "string"
                },
                {
                    name: "fee",
                    type: "expression",
                    valueType: "integer"
                }
            ],

            defaults: {
                customOutputs: [
                    {
                        name: "result",
                        type: "object:eez-flow-ext-uniswap/UniswapPoolAddress"
                    }
                ]
            },

            async onWasmWorkerMessage(flowState, message, messageId) {
                const { provider, token0, token1, fee } = message;

                const uniswapPoolAddress = new UniswapPoolAddress({
                    providerId: provider.id,
                    token0,
                    token1,
                    fee
                });

                try {
                    await uniswapPoolAddress.init();

                    flowState.sendResultToWorker(
                        messageId,
                        {
                            poolAddress: flowState.createObjectValue(
                                "object:eez-flow-ext-uniswap/UniswapPoolAddress",
                                uniswapPoolAddress
                            )
                        },
                        true
                    );
                } catch (err) {
                    flowState.sendResultToWorker(
                        messageId,
                        {
                            err: err.toString()
                        },
                        true
                    );
                }
            }
        });

        ////////////////////////////////////////////////////////////////////////////////

        registerActionComponent({
            name: "GetPoolPrice",

            icon: ICON,

            componentHeaderColor: "#FFCC66",

            bodyPropertyName: undefined,

            inputs: [],

            outputs: [],

            properties: [
                {
                    name: "poolAddress",
                    type: "expression",
                    valueType: "object:eez-flow-ext-uniswap/UniswapPoolAddress"
                },
                {
                    name: "quoterAddress",
                    type: "expression",
                    valueType: "string"
                },
                {
                    name: "token0Amount",
                    type: "expression",
                    valueType: "double"
                },
                {
                    name: "token0Decimals",
                    type: "expression",
                    valueType: "integer"
                },
                {
                    name: "token1Decimals",
                    type: "expression",
                    valueType: "integer"
                },
                {
                    name: "slippagePercent",
                    type: "expression",
                    valueType: "double"
                }
            ],

            defaults: {
                customOutputs: [
                    {
                        name: "result",
                        type: "object:eez-flow-ext-uniswap/UniswapPrice"
                    }
                ]
            },

            async onWasmWorkerMessage(flowState, message, messageId) {
                const {
                    poolAddress,
                    quoterAddress,
                    token0Amount,
                    token0Decimals,
                    token1Decimals,
                    slippagePercent
                } = message;

                const uniswapPrice = new UniswapPrice({
                    poolAddressId: poolAddress.id,
                    quoterAddress,
                    token0Amount,
                    token0Decimals,
                    token1Decimals,
                    slippagePercent
                });

                try {
                    await uniswapPrice.getPrice();

                    flowState.sendResultToWorker(
                        messageId,
                        {
                            price: flowState.createObjectValue(
                                "object:eez-flow-ext-uniswap/UniswapPrice",
                                uniswapPrice
                            )
                        },
                        true
                    );
                } catch (err) {
                    flowState.sendResultToWorker(
                        messageId,
                        { err: err.toString() },
                        true
                    );
                }
            }
        });

        ////////////////////////////////////////////////////////////////////////////////

        const etherumProviders = new Map<number, EtherumProvider>();
        let nextEtherumProvider = 1;

        class EtherumProvider {
            constructor(
                public constructorParams: EtherumProviderConstructorParams
            ) {
                this.id = nextEtherumProvider++;
                etherumProviders.set(this.id, this);

                this.provider = new ethers.providers.JsonRpcProvider(
                    this.constructorParams.url
                );
            }

            id: number;

            provider: ethers.providers.JsonRpcProvider;

            isConnected = false;
            error: string | undefined = undefined;

            get status() {
                return {
                    label: `Connected to ${this.constructorParams.url}`,
                    image: ICON,
                    color: this.error ? "red" : "green",
                    error: this.error
                };
            }
        }

        interface EtherumProviderConstructorParams {
            id?: number;
            url: string;
        }

        async function showProviderConnectDialog(
            variable: IVariable,
            values: IObjectVariableValueConstructorParams | undefined
        ) {
            try {
                const result = await showGenericDialog({
                    dialogDefinition: {
                        title: variable.description || variable.name,
                        size: "medium",
                        fields: [
                            {
                                name: "url",
                                displayName: "URL",
                                type: "string",
                                validators: [validators.required]
                            }
                        ],
                        error: undefined
                    },
                    values: values || {},
                    onOk: async (result: GenericDialogResult) => {
                        return true;
                    }
                });

                return result.values;
            } catch (err) {
                return undefined;
            }
        }

        registerObjectVariableType("EtherumProvider", {
            editConstructorParams: async (
                variable: IVariable,
                constructorParams?: IObjectVariableValueConstructorParams
            ): Promise<IObjectVariableValueConstructorParams | undefined> => {
                return await showProviderConnectDialog(
                    variable,
                    constructorParams
                );
            },

            createValue: (
                constructorParams: EtherumProviderConstructorParams
            ) => {
                if (constructorParams.id) {
                    const etherumProvider = etherumProviders.get(
                        constructorParams.id
                    );
                    if (etherumProvider) {
                        return etherumProvider;
                    }
                }
                return new EtherumProvider(constructorParams);
            },

            destroyValue: (value: EtherumProvider) => {
                //etherumProviders.delete(value.id);
            },

            valueFieldDescriptions: [
                {
                    name: "id",
                    valueType: "integer",
                    getFieldValue: (value: EtherumProvider) => value.id
                },
                {
                    name: "url",
                    valueType: "string",
                    getFieldValue: (value: EtherumProvider) =>
                        value.constructorParams.url
                }
            ]
        });

        ////////////////////////////////////////////////////////////////////////////////

        const uniswapPoolAddresses = new Map<number, UniswapPoolAddress>();
        let nextUniswapPoolAddress = 1;

        class UniswapPoolAddress {
            constructor(
                public constructorParams: UniswapPoolAddressConstructorParams
            ) {
                this.id = nextUniswapPoolAddress++;
                uniswapPoolAddresses.set(this.id, this);
            }

            async init() {
                const factoryAddress =
                    "0x1F98431c8aD98523631AE4a59f267346ea31F984"; // fixed, obtained from uniswap doc

                const etherumProvider = etherumProviders.get(
                    this.constructorParams.providerId
                );

                if (!etherumProvider) {
                    throw "Provider not found";
                }

                if (!etherumProvider.provider) {
                    throw "Invalid provider";
                }

                this.provider = etherumProvider.provider;

                const factoryContract = new ethers.Contract(
                    factoryAddress,
                    UniswapV3Factory,
                    this.provider
                );

                if (!factoryContract) {
                    throw "Failed to create factory contract";
                }

                this.poolAddress = await factoryContract.getPool(
                    this.constructorParams.token0,
                    this.constructorParams.token1,
                    this.constructorParams.fee
                );

                if (!this.poolAddress) {
                    throw "Failed to obtain pool address";
                }

                this.poolContract = new ethers.Contract(
                    this.poolAddress,
                    IUniswapV3PoolABI,
                    this.provider
                );

                if (!this.poolContract) {
                    throw "Failed to create pool contract";
                }
            }

            provider: ethers.providers.JsonRpcProvider;
            poolAddress: string;
            poolContract: ethers.Contract;

            id: number;

            isConnected = false;
            error: string | undefined = undefined;

            get status() {
                return {
                    label: `Connected`,
                    image: ICON,
                    color: this.error ? "red" : "green",
                    error: this.error
                };
            }
        }

        interface UniswapPoolAddressConstructorParams {
            id?: number;
            providerId: number;
            token0: string;
            token1: string;
            fee: number;
        }

        registerObjectVariableType("UniswapPoolAddress", {
            createValue: (
                constructorParams: UniswapPoolAddressConstructorParams
            ) => {
                if (constructorParams.id) {
                    const uniswapPoolAddress = uniswapPoolAddresses.get(
                        constructorParams.id
                    );
                    if (uniswapPoolAddress) {
                        return uniswapPoolAddress;
                    }
                }
                return new UniswapPoolAddress(constructorParams);
            },

            destroyValue: (value: UniswapPoolAddress) => {
                uniswapPoolAddresses.delete(value.id);
            },

            valueFieldDescriptions: [
                {
                    name: "id",
                    valueType: "integer",
                    getFieldValue: (value: EtherumProvider) => value.id
                },
                {
                    name: "providerId",
                    valueType: "integer",
                    getFieldValue: (value: UniswapPoolAddress) =>
                        value.constructorParams.providerId
                },
                {
                    name: "token0",
                    valueType: "string",
                    getFieldValue: (value: UniswapPoolAddress) =>
                        value.constructorParams.token0
                },
                {
                    name: "token1",
                    valueType: "string",
                    getFieldValue: (value: UniswapPoolAddress) =>
                        value.constructorParams.token1
                },
                {
                    name: "fee",
                    valueType: "integer",
                    getFieldValue: (value: UniswapPoolAddress) =>
                        value.constructorParams.fee
                },
                {
                    name: "poolAddress",
                    valueType: "string",
                    getFieldValue: (value: UniswapPoolAddress) =>
                        value.poolAddress
                }
            ]
        });

        ////////////////////////////////////////////////////////////////////////////////

        class UniswapPrice {
            constructor(
                public constructorParams: UniswapPriceConstructorParams
            ) {}

            isConnected = false;
            error: string | undefined = undefined;

            get status() {
                return {
                    label: `Connected`,
                    image: ICON,
                    color: this.error ? "red" : "green",
                    error: this.error
                };
            }

            token0Price: number;
            token1Price: number;
            inputAmount: number;
            outputAmount: number;
            fee: number;
            priceImpact: number;
            expectedPrice: number;

            async getPrice() {
                const uniswapPoolAddress = uniswapPoolAddresses.get(
                    this.constructorParams.poolAddressId
                );

                if (!uniswapPoolAddress) {
                    throw "Pool address not found";
                }

                if (!uniswapPoolAddress.provider) {
                    throw "Pool address provider not found";
                }

                if (!uniswapPoolAddress.poolContract) {
                    throw "Invalid pool contract";
                }

                const poolContract = uniswapPoolAddress.poolContract;

                interface Immutables {
                    factory: string;
                    token0: string;
                    token1: string;
                    fee: number;
                    tickSpacing: number;
                    maxLiquidityPerTick: ethers.BigNumber;
                }

                interface State {
                    liquidity: ethers.BigNumber;
                    sqrtPriceX96: ethers.BigNumber;
                    tick: number;
                    observationIndex: number;
                    observationCardinality: number;
                    observationCardinalityNext: number;
                    feeProtocol: number;
                    unlocked: boolean;
                }

                async function getPoolImmutables() {
                    const [
                        factory,
                        token0,
                        token1,
                        fee,
                        tickSpacing,
                        maxLiquidityPerTick
                    ] = await Promise.all([
                        poolContract.factory(),
                        poolContract.token0(),
                        poolContract.token1(),
                        poolContract.fee(),
                        poolContract.tickSpacing(),
                        poolContract.maxLiquidityPerTick()
                    ]);

                    const immutables: Immutables = {
                        factory,
                        token0,
                        token1,
                        fee,
                        tickSpacing,
                        maxLiquidityPerTick
                    };
                    return immutables;
                }

                async function getPoolState() {
                    // note that data here can be desynced if the call executes over the span of two or more blocks.
                    const [liquidity, slot] = await Promise.all([
                        poolContract.liquidity(),
                        poolContract.slot0()
                    ]);

                    const PoolState: State = {
                        liquidity,
                        sqrtPriceX96: slot[0],
                        tick: slot[1],
                        observationIndex: slot[2],
                        observationCardinality: slot[3],
                        observationCardinalityNext: slot[4],
                        feeProtocol: slot[5],
                        unlocked: slot[6]
                    };

                    return PoolState;
                }

                // query the state and immutable variables of the pool
                const [immutables, state] = await Promise.all([
                    getPoolImmutables(),
                    getPoolState()
                ]);

                // create instances of the Token object to represent the two tokens in the given pool
                const TokenA = new Token(
                    3,
                    immutables.token0,
                    this.constructorParams.token0Decimals,
                    "",
                    ""
                );

                const TokenB = new Token(
                    3,
                    immutables.token1,
                    this.constructorParams.token1Decimals,
                    "",
                    ""
                );

                // create an instance of the pool object for the given pool
                const poolInstance = new Pool(
                    TokenA,
                    TokenB,
                    immutables.fee,
                    state.sqrtPriceX96.toString(), //note the description discrepancy - sqrtPriceX96 and sqrtRatioX96 are interchangable values
                    state.liquidity.toString(),
                    state.tick
                );
                if (!poolInstance) {
                    throw "Failed to create pool instance";
                }

                // assign an input amount for the swap
                const amountIn = this.constructorParams.token0Amount;

                const quoterContract = new ethers.Contract(
                    this.constructorParams.quoterAddress,
                    QuoterABI,
                    uniswapPoolAddress.provider
                );

                // call the quoter contract to determine the amount out of a swap, given an amount in
                const quotedAmountOut =
                    await quoterContract.callStatic.quoteExactInputSingle(
                        immutables.token0,
                        immutables.token1,
                        immutables.fee,
                        amountIn.toString(),
                        0
                    );

                // create an instance of the route object in order to construct a trade object
                const swapRoute = new Route([poolInstance], TokenA, TokenB);
                if (!swapRoute) {
                    throw "Failed to create swap route";
                }

                // create an unchecked trade instance
                const uncheckedTrade = await Trade.createUncheckedTrade({
                    route: swapRoute,
                    inputAmount: CurrencyAmount.fromRawAmount(
                        TokenA,
                        amountIn.toString()
                    ),
                    outputAmount: CurrencyAmount.fromRawAmount(
                        TokenB,
                        quotedAmountOut.toString()
                    ),
                    tradeType: TradeType.EXACT_INPUT
                });
                if (!uncheckedTrade) {
                    throw "Failed to create unchecked trade";
                }

                this.token0Price = Number.parseFloat(
                    poolInstance.token0Price.toSignificant()
                );
                this.token1Price = Number.parseFloat(
                    poolInstance.token1Price.toSignificant()
                );
                this.fee = Number.parseFloat(poolInstance.fee.toString());

                this.inputAmount = Number.parseFloat(
                    uncheckedTrade.inputAmount.toSignificant()
                );
                this.outputAmount = Number.parseFloat(
                    uncheckedTrade.outputAmount.toSignificant()
                );
                this.priceImpact = Number.parseFloat(
                    uncheckedTrade.priceImpact.toSignificant()
                );

                const worstExecutionPrice =
                    await uncheckedTrade.worstExecutionPrice(
                        new Percent(
                            Math.round(
                                this.constructorParams.slippagePercent *
                                    1000000000
                            ),
                            1000000000
                        )
                    );

                this.expectedPrice = Number.parseFloat(
                    worstExecutionPrice.toSignificant()
                );
            }
        }

        interface UniswapPriceConstructorParams {
            poolAddressId: number;
            token0Amount: number;
            quoterAddress: string;
            token0Decimals: number;
            token1Decimals: number;
            slippagePercent: number;
        }

        registerObjectVariableType("UniswapPrice", {
            createValue: (constructorParams: UniswapPriceConstructorParams) => {
                return new UniswapPrice(constructorParams);
            },

            destroyValue: () => {},

            valueFieldDescriptions: [
                {
                    name: "token0Price",
                    valueType: "double",
                    getFieldValue: (value: UniswapPrice) => value.token0Price
                },
                {
                    name: "token1Price",
                    valueType: "double",
                    getFieldValue: (value: UniswapPrice) => value.token1Price
                },
                {
                    name: "inputAmount",
                    valueType: "double",
                    getFieldValue: (value: UniswapPrice) => value.inputAmount
                },
                {
                    name: "outputAmount",
                    valueType: "double",
                    getFieldValue: (value: UniswapPrice) => value.outputAmount
                },
                {
                    name: "fee",
                    valueType: "double",
                    getFieldValue: (value: UniswapPrice) => value.fee
                },
                {
                    name: "priceImpact",
                    valueType: "double",
                    getFieldValue: (value: UniswapPrice) => value.priceImpact
                },
                {
                    name: "expectedPrice",
                    valueType: "double",
                    getFieldValue: (value: UniswapPrice) => value.expectedPrice
                }
            ]
        });
    }
};
