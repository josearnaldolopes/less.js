(function (tree) {
    tree.toCSSVisitor = function(env) {
        this._visitor = new tree.visitor(this);
        this._env = env;
    };

    tree.toCSSVisitor.prototype = {
        isReplacing: true,
        run: function (root) {
            return this._visitor.visit(root);
        },

        visitRule: function (ruleNode, visitArgs) {
            if (ruleNode.variable) {
                return [];
            }
            return ruleNode;
        },

        visitMixinDefinition: function (mixinNode, visitArgs) {
            return [];
        },

        visitComment: function (commentNode, visitArgs) {
            if (commentNode.isSilent(this._env)) {
                return [];
            }
            return commentNode;
        },

        visitDirective: function(directiveNode, visitArgs) {
            if (directiveNode.name === "@charset") {
                // Only output the debug info together with subsequent @charset definitions
                // a comment (or @media statement) before the actual @charset directive would
                // be considered illegal css as it has to be on the first line
                if (this.charset) {
                    if (directiveNode.debugInfo) {
                        var comment = new tree.Comment("/* " + directiveNode.toCSS(this._env).replace(/\n/g, "")+" */\n");
                        comment.debugInfo = directiveNode.debugInfo;
                        return this._visitor.visit(comment);
                    }
                    return [];
                }
                this.charset = true;
            }
            return directiveNode;
        },

        checkPropertiesInRoot: function(rules) {
            var ruleNode;
            for(var i = 0; i < rules.length; i++) {
                ruleNode = rules[i];
                if (ruleNode instanceof tree.Rule && !ruleNode.variable) {
                    throw { message: "properties must be inside selector blocks, they cannot be in the root.",
                        index: ruleNode.index, filename: ruleNode.currentFileInfo ? ruleNode.currentFileInfo.filename : null};
                }
            }
        },

        visitRuleset: function (rulesetNode, visitArgs) {
            var rule, rulesets = [];
            if (rulesetNode.firstRoot) {
                this.checkPropertiesInRoot(rulesetNode.rules);
            }
            if (! rulesetNode.root) {

                rulesetNode.paths = rulesetNode.paths
                    .filter(function(p) {
                        var i;
                        for(i = 0; i < p.length; i++) {
                            if (p[i].getIsReferenced() && p[i].getIsOutput()) {
                                return true;
                            }
                            return false;
                        }
                    });

                // Compile rules and rulesets
                for (var i = 0; i < rulesetNode.rules.length; i++) {
                    rule = rulesetNode.rules[i];

                    if (rule.rules) {
                        // visit because we are moving them out from being a child
                        rulesets.push(this._visitor.visit(rule));
                        rulesetNode.rules.splice(i, 1);
                        i--;
                        continue;
                    }
                }
                // accept the visitor to remove rules and refactor itself
                // then we can decide now whether we want it or not
                if (rulesetNode.rules.length > 0 && rulesetNode.paths.length > 0) {
                    rulesetNode.accept(this._visitor);
                }
                visitArgs.visitDeeper = false;

                // now decide whether we keep the ruleset
                if (rulesets.length > 0 && rulesetNode.rules.length > 0 && rulesetNode.paths.length > 0) {
                    rulesets.splice(0, 0, rulesetNode);
                }
            }
            if (rulesets.length === 0) {
                rulesets = rulesetNode;
            }
            return rulesets;
        }
    };

})(require('./tree'));