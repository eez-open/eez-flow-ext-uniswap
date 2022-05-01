import { IEezFlowRuntime, IDashboardComponentContext } from "eez-studio-types";

export default {
    eezFlowExtensionInit: (eezFlowRuntime: IEezFlowRuntime) => {
        const { registerExecuteFunction } = eezFlowRuntime;

        registerExecuteFunction(
            "GetPoolAddress",
            function (context: IDashboardComponentContext) {
                const provider = context.evalProperty("provider");
                if (!provider) {
                    context.throwError(`Invalid provider`);
                    return;
                }

                const token0 = context.evalProperty<string>("token0");
                if (!token0) {
                    context.throwError(`Invalid token0`);
                    return;
                }

                const token1 = context.evalProperty<string>("token1");
                if (!token1) {
                    context.throwError(`Invalid token1`);
                    return;
                }

                const fee = context.evalProperty<number>("fee");
                if (fee == undefined) {
                    context.throwError(`Invalid fee`);
                    return;
                }

                context = context.startAsyncExecution();

                context.sendMessageToComponent(
                    {
                        provider,
                        token0,
                        token1,
                        fee
                    },
                    result => {
                        if (result.err !== undefined) {
                            context.throwError(result.err);
                        } else {
                            context.propagateValue(
                                "result",
                                result.poolAddress
                            );
                            context.propagateValueThroughSeqout();
                        }
                        context.endAsyncExecution();
                    }
                );
            }
        );

        registerExecuteFunction(
            "GetPoolPrice",
            function (context: IDashboardComponentContext) {
                const poolAddress = context.evalProperty("poolAddress");
                if (!poolAddress) {
                    context.throwError(`Invalid pool address`);
                    return;
                }

                const quoterAddress =
                    context.evalProperty<string>("quoterAddress");
                if (!quoterAddress) {
                    context.throwError(`Invalid quoter address`);
                    return;
                }

                const token0Amount =
                    context.evalProperty<number>("token0Amount");
                if (token0Amount == undefined) {
                    context.throwError(`Invalid token0 amount`);
                    return;
                }

                const token0Decimals =
                    context.evalProperty<number>("token0Decimals");
                if (token0Decimals == undefined) {
                    context.throwError(`Invalid token0 decimals`);
                    return;
                }

                const token1Decimals =
                    context.evalProperty<number>("token1Decimals");
                if (token1Decimals == undefined) {
                    context.throwError(`Invalid token1 decimals`);
                    return;
                }

                const slippagePercent =
                    context.evalProperty<number>("slippagePercent");
                if (slippagePercent == undefined) {
                    context.throwError(`Invalid slippage percent`);
                    return;
                }

                context = context.startAsyncExecution();

                context.sendMessageToComponent(
                    {
                        poolAddress,
                        quoterAddress,
                        token0Amount,
                        token0Decimals,
                        token1Decimals,
                        slippagePercent
                    },
                    result => {
                        if (result.err !== undefined) {
                            context.throwError(result.err);
                        } else {
                            context.propagateValue("result", result.price);
                            context.propagateValueThroughSeqout();
                        }
                        context.endAsyncExecution();
                    }
                );
            }
        );
    }
};
